import type { Metadata } from "next";

import { pageTitle, SegmentLayout } from "../../../lib/segment-layout";

export const metadata: Metadata = { title: pageTitle("Conversation") };

export default SegmentLayout;
