import React from "react";
import { NextPage } from "next";
import Head from "next/head";

import SupportChatView from "@/views/SupportChatView";

// [CHANGE] F66: live support chat on the web storefront.
const SupportChatPage: NextPage = () => {
  return (
    <>
      <Head>
        <title>Support</title>
        <meta name="description" content="Chat with support." />
      </Head>
      <SupportChatView />
    </>
  );
};

export default SupportChatPage;
