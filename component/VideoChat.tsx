import { useEffect, useRef, useState } from "react";
import { Button } from "@mui/material";
import { db } from "../fireb/firebApp";
import styles from "./VideoChat.module.scss";
import {
  doc,
  collection,
  addDoc,
  setDoc,
  onSnapshot,
  getDoc,
  updateDoc,
} from "firebase/firestore";
// import { collection, doc } from "firebase/firestore";

const VideoChat = () => {
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const servers = {
    iceServers: [
      {
        urls: [
          "stun:stun1.l.google.com:19302",
          "stun:stun2.l.google.com:19302",
        ],
      },
    ],
    iceCandidatePoolSize: 10,
  };
  // Global State
  const [pc, setPc] = useState<RTCPeerConnection | null>(null);
  if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;

  useEffect(() => {
    async function init() {
      const conn = new RTCPeerConnection(servers);
      const localStream = await navigator.mediaDevices.getUserMedia({
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
  //createRoom
  const [roomLink, setRoomLink] = useState("");
  const [joinLink, setJoinLink] = useState("");

  async function createRoom() {
    // Reference Firestore collections for signaling
    const callDoc = doc(collection(db, "calls"));

    const offerCandidates = collection(callDoc, "offerCandidates");
    const answerCandidates = collection(callDoc, "answerCandidates");

    setRoomLink(callDoc.id);

    // Get candidates for caller, save to db
    pc!.onicecandidate = (event) => {
      event.candidate && addDoc(offerCandidates, event.candidate?.toJSON());
    };

    // Create offer
    const offerDescription = await pc!.createOffer();
    console.log(offerDescription);
    console.log("valid", offerDescription);

    await pc!.setLocalDescription(offerDescription);
    const offer = {
      sdp: offerDescription.sdp,
      type: offerDescription.type,
    };
    setDoc(callDoc, { offer });

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
          console.log("ICE CANDIDATES ARE: ", candidate);

          pc!.addIceCandidate(candidate);
        }
      });
    });
  }
  async function joinRoom() {
    const callDoc = doc(db, "calls", joinLink);
    const offerCandidates = collection(callDoc, "offerCandidates");
    const answerCandidates = collection(callDoc, "answerCandidates");
    pc!.onicecandidate = (event) => {
      event.candidate && addDoc(answerCandidates, event.candidate?.toJSON());
    };

    const callData = (await getDoc(callDoc)).data();

    const offerDescription = callData && callData.offer;
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
        console.log(change);
        if (change.type === "added") {
          let data = change.doc.data();
          pc!.addIceCandidate(new RTCIceCandidate(data));
        }
      });
    });
  }
  function start() {
    pc!.ontrack = (event) => {
      event.streams[0].getTracks().forEach((track) => {
        remoteStream?.addTrack(track);
      });
    };
  }
  return (
    <main className={styles.main}>
      <div>
        <video
          className={styles.localVdo}
          ref={localVideoRef}
          autoPlay
          playsInline
        />
        <video
          className={styles.remoteVdo}
          ref={remoteVideoRef}
          autoPlay
          playsInline
        />
      </div>
      <button onClick={start}>Start vdo</button>
      <h2>1. Create Room</h2>
      <button onClick={createRoom}>Create Call (offer)</button>
      <h3>Link: {roomLink}</h3>

      <h2>2. Join Room</h2>
      <p>Answer the call from a different browser window or device</p>
      <input
        type="text"
        value={joinLink}
        onChange={(e) => setJoinLink(e.currentTarget.value)}
      />
      <button id="answerButton" onClick={joinRoom}>
        Join Room
      </button>

      <h2>4. Hangup</h2>

      <button id="hangupButton">Hangup</button>
    </main>
  );
};

export default VideoChat;
