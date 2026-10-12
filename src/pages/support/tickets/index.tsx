import React from "react";
import { NextPage } from "next";
import Head from "next/head";

import SupportTicketsView from "@/views/SupportTicketsView";

// [CHANGE] F64: support tickets on the web storefront.
const SupportTicketsPage: NextPage = () => {
  return (
    <>
      <Head>
        <title>Support tickets</title>
        <meta name="description" content="Raise a support request and track it." />
      </Head>
      <SupportTicketsView />
    </>
  );
};

export default SupportTicketsPage;
