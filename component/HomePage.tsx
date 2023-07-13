import { Button, Container, Link, Typography } from "@mui/material";
import Image from "next/image";
import styles from "./Styles/HomePage.module.scss";
export default function HomePage() {
  return (
    <main>
      <Container style={{ width: "100vw", height: "100vh" }}>
        <Typography variant="h3" marginTop={"2vh"} align="center" gutterBottom>
          Coral MeetUp
        </Typography>
        <div className={styles.logoWrapper}>
          <div className={styles.logo}>
            <Image src="/logo.png" alt="logo" fill={true} />
          </div>
        </div>
        <Typography variant="subtitle1" align="center" gutterBottom>
          Bringing People Closer Through Video Calls
        </Typography>
        <br />
        <br />
        <div
          style={{ display: "flex", justifyContent: "center", marginTop: 32 }}
        >
          <Link href="/stranger">
            <Button
              variant="contained"
              color="primary"
              style={{ marginRight: 16 }}
            >
              Meet someone new!
            </Button>
          </Link>
          <Link href="/friend">
            <Button variant="outlined" color="primary">
              Connect with a friend
            </Button>
          </Link>
        </div>
        <br />
        <Typography
          variant="subtitle1"
          align="center"
          gutterBottom
          style={{ marginTop: 16 }}
        >
          Choose how you want to connect: with a new friend or a loved one.
        </Typography>
      </Container>
    </main>
  );
}
