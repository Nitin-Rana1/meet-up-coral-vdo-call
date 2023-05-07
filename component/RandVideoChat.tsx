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
export default function RandVideoChat() {
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [pc, setPc] = useState<RTCPeerConnection | null>(null);
  if (remoteVideoRef.current) {
    console.log("remoVdo");
    remoteVideoRef.current.srcObject = remoteStream;
  }
  async function init() {
    const conn = new RTCPeerConnection(servers);
    const localStream = await navigator.mediaDevices.getUserMedia({
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
  useEffect(() => {
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

  //connection lost
  useEffect(() => {
    if (pc) {
      // checking for connection
      pc.addEventListener("iceconnectionstatechange", () => {
        console.log("ICE connection state:", pc.iceConnectionState);
        if (pc.iceConnectionState === "disconnected") {
          reconnect();
        }
      });
    } else console.log("not pcxxxxlost con ");
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
  const reconnect = async () => {
    // Get an array of RTCRtpSender objects
    const senders = pc!.getSenders();

    // Loop through the senders and replace the track with null
    senders.forEach((sender) => {
      const track = sender.track;
      if (track) {
        sender
          .replaceTrack(null)
          .then(() => console.log(`Track removed from sender `))
          .catch((err) => console.error(`Error removing track from sender `));
      }
    });
    const localStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: false,
    });
    localVideoRef.current!.srcObject = localStream;
    setRemoteStream(new MediaStream());
    localStream.getTracks().forEach((track) => {
      pc!.addTrack(track, localStream);
    });
    connect();
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
            Connect HEART
          </Button>
          <Button onClick={reconnect} variant="contained">
            REConnect
          </Button>
        </section>
      </div>
    </main>
  );
}
