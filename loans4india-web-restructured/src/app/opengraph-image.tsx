import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";

/** Default social preview for every page that doesn't set its own: the logo and the two promises v4 requires. */
export const alt = "Loans4India: loan sourcing service, not a lender. No fee from you.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OgImage() {
  const logo = await readFile(path.join(process.cwd(), "public/brand/loans4india-logo.png"));
  const src = `data:image/png;base64,${logo.toString("base64")}`;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: 80, background: "linear-gradient(135deg, #ffffff 55%, #e8faf3 100%)" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} width={560} height={125} alt="" />
        <div style={{ marginTop: 48, fontSize: 54, fontWeight: 800, color: "#14122b", lineHeight: 1.15, display: "flex" }}>One application. The right bank.</div>
        <div style={{ marginTop: 24, fontSize: 30, color: "#55526b", display: "flex" }}>Loan sourcing service, not a lender · No fee from you</div>
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 18, background: "#36d49f", display: "flex" }} />
      </div>
    ),
    size,
  );
}
