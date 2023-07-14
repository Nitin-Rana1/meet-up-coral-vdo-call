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
import styles from "../../styles/Friend.module.scss";
import { Fragment, useEffect, useRef, useState } from "react";

import { db } from "../../fireb/firebApp";
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
import { useRouter } from "next/router";
const servers = {
  iceServers: [
    {
      urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"],
    },
  ],
  iceCandidatePoolSize: 10,
};
export default function JoinFriend() {
  const router = useRouter();
  const { roomId } = router.query;
  useEffect(() => {
    if (roomId) joinRoom(roomId[0]);
  }, []);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [pc, setPc] = useState<RTCPeerConnection | null>(null);

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
  }, [pc, remoteStream]);

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
  const [myMicMuted, setMyMicMuted] = useState(false);
  const [vdoOn, setVdoOn] = useState(true);
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
              <Mic
                sx={{ color: "#31c5f1", fontSize: 50, marginRight: "3vw" }}
                onClick={resumeMyAudio}
              />
            ) : (
              <MicOffRounded
                sx={{ color: "red", fontSize: 50, marginRight: "3vw" }}
                onClick={pauseMyAudio}
              />
            )}
            {vdoOn ? (
              <VideocamOff
                sx={{ color: "red", fontSize: 50, marginRight: "3vw" }}
                onClick={pauseVdo}
              />
            ) : (
              <Videocam
                sx={{ color: "#31c5f1", fontSize: 50, marginRight: "3vw" }}
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
    </Container>
  );
}
