import {
  Container,
  Typography,
  Button,
  TextField,
  SwipeableDrawer,
  Box,
  Divider,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Dialog,
  DialogContent,
  DialogContentText,
  DialogTitle,
  DialogActions,
  Tabs,
  Tab,
  Link,
} from "@mui/material";
import styles from "../styles/Friend.module.scss";
import { Fragment, useEffect, useRef, useState } from "react";

import { db } from "../fireb/firebApp";
import {
  doc,
  collection,
  addDoc,
  setDoc,
  onSnapshot,
  getDocs,
  updateDoc,
  query,
  where,
  limit,
  getDoc,
  DocumentReference,
  DocumentData,
  serverTimestamp,
} from "firebase/firestore";
import { list } from "firebase/storage";
import { WhatsappShareButton } from "react-share";
import {
  Mic,
  Duo,
  CallEndRounded,
  MicOffRounded,
  VideocamOff,
  Videocam,
  Share,
  Settings,
  Close,
} from "@mui/icons-material";
const servers = {
  iceServers: [
    {
      urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"],
    },
  ],
  iceCandidatePoolSize: 10,
};
export default function Friend() {
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [pc, setPc] = useState<RTCPeerConnection | null>(null);
  const [createdLink, setCreatedLink] = useState("");
  const [joiningLink, setJoiningLink] = useState("");

  const [myMicMuted, setMyMicMuted] = useState(true);
  const [vdoOn, setVdoOn] = useState(true);
  
  useEffect(() => {
    if (remoteVideoRef.current) {
      console.log("remoVdo");
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);
  useEffect(() => {
    async function init() {
      const conn = new RTCPeerConnection(servers);
      const localStream = await navigator.mediaDevices?.getUserMedia({
        video: true,
        audio: false,
      });
      localVideoRef.current!.srcObject = localStream;
      setRemoteStream(new MediaStream());
      // Push tracks from local stream to peer connection
      localStream.getTracks().forEach((track) => {
        conn.addTrack(track, localStream);
      });
      setPc(conn);
    }
    init();
  }, []);
  //event listener
  useEffect(() => {
    if (pc) {
      console.log("pc ");
      pc.ontrack = (event) => {
        event.streams[0].getTracks().forEach((track) => {
          remoteStream?.addTrack(track);
        });
      };
    } else console.log("not pc ");
  }, [pc, remoteStream]);
  //createRoom
  async function createRoom() {
    if (pc) console.log("PC creating room");
    else console.log("creating room");
    // Create offer
    const offerDescription = await pc!.createOffer();
    const offer = {
      sdp: offerDescription.sdp,
      type: offerDescription.type,
    };
    // Reference Firestore collections for signaling
    const callDoc = await addDoc(collection(db, "calls"), {
      offer,
      answer: null,
      createdAt: serverTimestamp(),
    });
    setCreatedLink(callDoc.id);
    //offercandidates
    const offerCandidates = collection(callDoc, "offerCandidates");
    const oc = collection(callDoc, "TOP G");

    // Get candidates for caller, save to db
    pc!.onicecandidate = (event) => {
      console.log("In under onICEcandidate");
      if (!event.candidate) console.log("EVENT hi ni hai");
      else console.log("Event !!!");
      event.candidate && addDoc(offerCandidates, event.candidate?.toJSON());
    };
    await pc!.setLocalDescription(offerDescription);

    const answerCandidates = collection(callDoc, "answerCandidates");

    // Listen for remote answer
    onSnapshot(callDoc, (snapshot) => {
      const data = snapshot.data();
      if (!pc!.currentRemoteDescription && data?.answer) {
        const answerDescription = new RTCSessionDescription(data.answer);
        pc!.setRemoteDescription(answerDescription);
      }
    });

    // When answered, add candidate to peer connection
    onSnapshot(answerCandidates, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const candidate = new RTCIceCandidate(change.doc.data());
          pc!.addIceCandidate(candidate);
        }
      });
    });
  }
  async function joinRoom(id: string) {
    console.log("joining room");
    const callDoc = doc(db, "calls", id);
    const offerCandidates = collection(callDoc, "offerCandidates");
    const answerCandidates = collection(callDoc, "answerCandidates");
    pc!.onicecandidate = (event) => {
      event.candidate && addDoc(answerCandidates, event.candidate?.toJSON());
    };

    const callData = (await getDoc(callDoc)).data();

    const offerDescription = callData!.offer;
    await pc!.setRemoteDescription(new RTCSessionDescription(offerDescription));
    const answerDescription = await pc!.createAnswer();
    await pc!.setLocalDescription(answerDescription);
    const answer = {
      type: answerDescription.type,
      sdp: answerDescription.sdp,
    };
    await updateDoc(callDoc, {
      answer,
    });

    onSnapshot(offerCandidates, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          let data = change.doc.data();
          pc!.addIceCandidate(new RTCIceCandidate(data));
        }
      });
    });
  }

  const pauseVdo = () => {
    setVdoOn(false);
    const localStream = localVideoRef.current!.srcObject as MediaStream | null;
    const tracks = localStream!.getVideoTracks();
    tracks.forEach((track) => {
      track.enabled = false;
    });
  };

  const resumeVdo = () => {
    setVdoOn(true);
    const localStream = localVideoRef.current!.srcObject as MediaStream | null;
    const tracks = localStream!.getVideoTracks();
    tracks.forEach((track) => {
      track.enabled = true;
    });
  };

  const pauseMyAudio = () => {
    setMyMicMuted(true);
    const localStream = localVideoRef.current!.srcObject as MediaStream | null;
    // Disable audio tracks
    localStream!.getAudioTracks().forEach((track) => {
      track.enabled = false;
    });
  };
  const resumeMyAudio = () => {
    setMyMicMuted(false);
    const localStream = localVideoRef.current!.srcObject as MediaStream | null;
    // Disable audio tracks
    localStream!.getAudioTracks().forEach((track) => {
      track.enabled = true;
    });
  };
  return (
    <Container className={styles.container}>
      <section className={styles.videos}>
        <video
          ref={remoteVideoRef}
          className={styles.remoteVideo}
          playsInline
          autoPlay
        />
        <video
          ref={localVideoRef}
          className={styles.localVideo}
          playsInline
          muted
          autoPlay
        />
        <article>
          <div>
            {myMicMuted ? (
              <MicOffRounded
                sx={{ color: "red", fontSize: 50, marginRight: "3vw" }}
                onClick={resumeMyAudio}
              />
            ) : (
              <Mic
                sx={{ color: "#31c5f1", fontSize: 50, marginRight: "3vw" }}
                onClick={pauseMyAudio}
              />
            )}
            {vdoOn ? (
              <Videocam
                sx={{ color: "#31c5f1", fontSize: 50, marginRight: "3vw" }}
                onClick={pauseVdo}
              />
            ) : (
              <VideocamOff
                sx={{ color: "red", fontSize: 50, marginRight: "3vw" }}
                onClick={resumeVdo}
              />
            )}
            <Link href="/friend">
              <CallEndRounded
                sx={{
                  color: "red",
                  fontSize: 50,
                  marginRight: "3vw",
                }}
              />
            </Link>
          </div>
        </article>
      </section>
      <SwipeableTemporaryDrawer
        createdLink={createdLink}
        joiningLink={joiningLink}
        setJoiningLink={setJoiningLink}
        setCreatedLink={setCreatedLink}
        createRoom={createRoom}
        joinRoom={joinRoom}
        pc={pc}
      />
    </Container>
  );
}

function SwipeableTemporaryDrawer({
  createdLink,
  joiningLink,
  setJoiningLink,
  setCreatedLink,
  createRoom,
  joinRoom,
  pc,
}: {
  createdLink: string;
  joiningLink: string;
  setJoiningLink: (x: string) => void;
  setCreatedLink: (x: string) => void;
  createRoom: () => void;
  joinRoom: (x: string) => void;
  pc: RTCPeerConnection | null;
}) {
  const [bottom, setBottom] = useState(true);

  const [invalidJoiningLink, setInvalidJoiningLink] = useState(false);
  const [tabNo, setTabNo] = useState(0);
  const handleChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabNo(newValue);
  };
  useEffect(() => {
    setBottom(true);
  }, []);

  const toggleDrawer =
    (open: boolean) => (event: React.KeyboardEvent | React.MouseEvent) => {
      if (
        event &&
        event.type === "keydown" &&
        ((event as React.KeyboardEvent).key === "Tab" ||
          (event as React.KeyboardEvent).key === "Shift")
      ) {
        return;
      }

      setBottom(open);
    };

  const list = () => (
    <Box
      sx={{
        width: "auto",
        marginBottom: "2vh",
        padding: "2vw",
        position: "relative",
      }}
      role="presentation"
      // onClick={toggleDrawer(false)}
      // onKeyDown={toggleDrawer(false)}
    >
      <Tabs
        value={tabNo}
        onChange={handleChange}
        aria-label="basic tabs example"
      >
        <Tab label="Join Room" onClick={() => setTabNo(0)} />
        <Tab label="Create Room" onClick={() => setTabNo(1)} />
      </Tabs>
      <Close className={styles.settingIconInMenu} onClick={settingClick} />
      {tabNo == 0 && (
        <section
          style={{
            marginTop: "5vh",
            padding: "4vw",
          }}
        >
          <TextField
            label="Paste Video Call Link"
            value={joiningLink}
            fullWidth
            onChange={(event) => setJoiningLink(event.target.value)}
            variant="outlined"
            margin="normal"
          />
          <Button
            variant="contained"
            color="primary"
            onClick={() => {
              if (joiningLink == "") {
                setInvalidJoiningLink(true);
              } else joinRoom(joiningLink);
            }}
            fullWidth
          >
            Join Room
          </Button>
        </section>
      )}
      {tabNo == 1 && (
        <section
          style={{
            marginTop: "5vh",
            padding: "4vw",
          }}
        >
          <Typography variant="body1" align="center" gutterBottom>
            Your Room Link : {createdLink == "" ? "None!" : createdLink}
          </Typography>
          <Button
            variant="text"
            onClick={() =>
              navigator.share({
                text: "https://meet-up-coral.vercel.app/friend/" + createdLink,
                title: "Connect with me on Video chat",
              })
            }
          >
            <Share style={{ marginRight: "1vw" }} />
            Share link!
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={createRoom}
            fullWidth
            sx={{
              marginTop: "1.5vw",
              // backgroundColor: "#1e88e5",
              // "&:hover": {
              //   backgroundColor: "#1565c0",
              // },
            }}
          >
            Create Room
          </Button>
          <Dialog
            open={invalidJoiningLink}
            onClose={() => setInvalidJoiningLink(false)}
          >
            <DialogTitle>Error</DialogTitle>
            <DialogContent>
              <Typography>
                Please enter a valid room link to join the call.
              </Typography>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setInvalidJoiningLink(false)}>OK</Button>
            </DialogActions>
          </Dialog>
        </section>
      )}
    </Box>
  );
  function settingClick() {
    setBottom((prevValue) => !prevValue);
  }
  return (
    <div>
      <div>
        <Settings className={styles.settingIcon} onClick={settingClick} />
      </div>
      <Fragment>
        <SwipeableDrawer
          anchor={"bottom"}
          open={bottom}
          onClose={toggleDrawer(false)}
          onOpen={toggleDrawer(true)}
        >
          {list()}
        </SwipeableDrawer>
      </Fragment>
    </div>
  );
}
