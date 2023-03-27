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
  getDocs,
  updateDoc,
  query,
  where,
  limit,
  getDoc,
  DocumentReference,
  DocumentData,
} from "firebase/firestore";
// import { collection, doc } from "firebase/firestore";

const servers = {
  iceServers: [
    {
      urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"],
    },
  ],
  iceCandidatePoolSize: 10,
};
const VideoChat = () => {
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

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
  useEffect(() => {
    if (pc) {
      pc.ontrack = (event) => {
        event.streams[0].getTracks().forEach((track) => {
          remoteStream?.addTrack(track);
        });
      };
      const callDoc = doc(collection(db, "calls"));
      const offerCandidates = collection(callDoc, "offerCandidates");
      // Get candidates for caller, save to db
      pc!.onicecandidate = (event) => {
        event.candidate && addDoc(offerCandidates, event.candidate?.toJSON());
      };
    }
  }, [pc]);
  //createRoom
  async function createRoom() {
    console.log("creating room");
    // Create offer
    const offerDescription = await pc!.createOffer();
    await pc!.setLocalDescription(offerDescription);
    const offer = {
      sdp: offerDescription.sdp,
      type: offerDescription.type,
    };
    // Reference Firestore collections for signaling
    const callDoc = await addDoc(collection(db, "calls"), {
      offer,
      answer: null,
    });
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
  async function joinRoom(callDoc: DocumentReference<DocumentData>) {
    console.log("joining room");
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
  const connect = async () => {
    const collectionRef = collection(db, "calls");
    const q = query(collectionRef, where("answer", "==", null), limit(1));

    const qSnapshot = await getDocs(q);
    if (qSnapshot.docs.length > 0) {
      joinRoom(qSnapshot.docs[0].ref);
    } else {
      createRoom();
    }
  };
  return (
    <main className={styles.main}>
      <div className={styles.remoteVdoWrapper}>
        <video
          className={styles.remoteVdo}
          ref={remoteVideoRef}
          autoPlay
          playsInline
        />
      </div>
      <div className={styles.form}>
        <video
          className={styles.localVdo}
          ref={localVideoRef}
          autoPlay
          muted
          playsInline
        />
        <section>
          <Button onClick={connect} variant="contained">
            Connect
          </Button>
        </section>
      </div>
    </main>
  );
};

export default VideoChat;

// async function createRoom() {
//   // Reference Firestore collections for signaling
//   const callDoc = doc(collection(db, "calls"));

//   const answerCandidates = collection(callDoc, "answerCandidates");

//   setRoomLink(callDoc.id);

//   // Create offer
//   const offerDescription = await pc!.createOffer();
//   await pc!.setLocalDescription(offerDescription);
//   const offer = {
//     sdp: offerDescription.sdp,
//     type: offerDescription.type,
//   };

//   setDoc(callDoc, { offer });

//   // Listen for remote answer
//   onSnapshot(callDoc, (snapshot) => {
//     const data = snapshot.data();
//     if (!pc!.currentRemoteDescription && data?.answer) {
//       const answerDescription = new RTCSessionDescription(data.answer);
//       pc!.setRemoteDescription(answerDescription);
//     }
//   });

//   // When answered, add candidate to peer connection
//   onSnapshot(answerCandidates, (snapshot) => {
//     snapshot.docChanges().forEach((change) => {
//       if (change.type === "added") {
//         const candidate = new RTCIceCandidate(change.doc.data());
//         pc!.addIceCandidate(candidate);
//       }
//     });
//   });
// }
// async function joinRoom() {
//   const callDoc = doc(db, "calls", joinLink);
//   const offerCandidates = collection(callDoc, "offerCandidates");
//   const answerCandidates = collection(callDoc, "answerCandidates");
//   pc!.onicecandidate = (event) => {
//     event.candidate && addDoc(answerCandidates, event.candidate?.toJSON());
//   };

//   const callData = (await getDoc(callDoc)).data();

//   const offerDescription = callData && callData.offer;
//   await pc!.setRemoteDescription(new RTCSessionDescription(offerDescription));
//   const answerDescription = await pc!.createAnswer();
//   await pc!.setLocalDescription(answerDescription);
//   const answer = {
//     type: answerDescription.type,
//     sdp: answerDescription.sdp,
//   };
//   await updateDoc(callDoc, {
//     answer,
//   });

//   onSnapshot(offerCandidates, (snapshot) => {
//     snapshot.docChanges().forEach((change) => {
//       if (change.type === "added") {
//         let data = change.doc.data();
//         pc!.addIceCandidate(new RTCIceCandidate(data));
//       }
//     });
//   });
// }
