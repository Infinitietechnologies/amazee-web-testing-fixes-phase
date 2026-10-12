import React from "react";
import MembershipView from "@/views/MembershipView";
import { NextPage } from "next";
import Head from "next/head";

const MembershipPage: NextPage = () => {
  return (
    <>
      <Head>
        {/* [CHANGE 2026-09-22] The title read "Membership Plans | Murli" — a
            placeholder name from a scratch edit, on a customer-facing tab. */}
        <title>Membership Plans</title>
        <meta name="description" content="Choose a membership plan to unlock exclusive benefits and free delivery." />
      </Head>
      <MembershipView />
    </>
  );
};

export default MembershipPage;
