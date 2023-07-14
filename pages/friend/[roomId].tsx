import { useRouter } from "next/router";
import { useEffect } from "react";

export default function JoinFriend() {
  const router = useRouter();
  const { roomId } = router.query;
  useEffect(() => {}, []);
  return <main></main>;
}
