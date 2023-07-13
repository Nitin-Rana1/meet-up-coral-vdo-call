import Head from "next/head";
import Image from "next/image";
import VideoChat from "../component/VideoChat";
import RandVideoChat from "../component/RandVideoChat";
import HomePage from "../component/HomePage";

export default function Home() {
  return (
    <main>
      <Head>
        <title>Meet Up Coral</title>
        <meta
          name="description"
          content="Video Call with Strangers And Friends "
        />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      {<HomePage />}
    </main>
  );
}
