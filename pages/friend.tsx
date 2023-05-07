import {
  Container,
  Typography,
  Button,
  TextField,
  Drawer,
  SwipeableDrawer,
  Box,
  Divider,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
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
} from "firebase/firestore";
import { list } from "firebase/storage";
const servers = {
  iceServers: [
    {
      urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"],
    },
  ],
  iceCandidatePoolSize: 10,
};
export default function friend() {
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [pc, setPc] = useState<RTCPeerConnection | null>(null);
  const [createdLink, setCreatedLink] = useState("");
  const [joiningLink, setJoiningLink] = useState("");
  const [bottomPopUp, setBottomPopUp] = useState(true);
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
        audio: true,
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
  }, [pc]);
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
  return (
    <Container className={styles.container}>
      {/* <Typography variant="h4" align="center" gutterBottom>
        Connect with a friend
      </Typography> */}
      <section className={styles.videos}>
        {/* <div className={styles.videos}> */}
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
      </section>
      <BottomSlider
        bottomPopUp={bottomPopUp}
        setBottomPopUp={setBottomPopUp}
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
function BottomSlider({
  bottomPopUp,
  setBottomPopUp,
  createdLink,
  joiningLink,
  setJoiningLink,
  setCreatedLink,
  createRoom,
  joinRoom,
  pc,
}: {
  bottomPopUp: boolean;
  setBottomPopUp: (x: boolean) => void;
  createdLink: string;
  joiningLink: string;
  setJoiningLink: (x: string) => void;
  setCreatedLink: (x: string) => void;
  createRoom: () => void;
  joinRoom: (x: string) => void;
  pc: RTCPeerConnection | null;
}) {
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

      setBottomPopUp(open);
    };

  const list = () => (
    <Box
      sx={{ width: "auto" }}
      role="presentation"
      //   onClick={toggleDrawer(false)}
      onKeyDown={toggleDrawer(false)}
    >
      <div className={styles.links}>
        <TextField
          label="Link to share"
          value={createdLink}
          fullWidth
          InputProps={{
            readOnly: true,
          }}
          variant="outlined"
          margin="normal"
        />
        <TextField
          label="Link to join"
          value={joiningLink}
          fullWidth
          onChange={(event) => setJoiningLink(event.target.value)}
          variant="outlined"
          margin="normal"
        />
        <Button
          variant="contained"
          color="primary"
          disabled={!pc}
          onClick={createRoom}
          fullWidth
          className={styles.button}
        >
          Create Room
        </Button>
        <Button
          variant="contained"
          color="secondary"
          disabled={!pc || !joiningLink}
          onClick={() => joinRoom(joiningLink)}
          fullWidth
          className={styles.button}
        >
          Join Room
        </Button>
      </div>
    </Box>
  );

  return (
    <div>
      <Fragment key={"bottom"}>
        {/* <Button onClick={toggleDrawer(true)}>{"bottom"}</Button> */}
        <SwipeableDrawer
          anchor={"bottom"}
          open={bottomPopUp}
          onClose={toggleDrawer(false)}
          onOpen={toggleDrawer(true)}
        >
          {list()}
        </SwipeableDrawer>
      </Fragment>
    </div>
  );
}
