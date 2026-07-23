export const metadata = {
  title: "Siplinx AI — Privacy Policy",
  description: "How Siplinx AI handles your data",
};

const S = {
  page: {
    minHeight: "100vh",
    background: "#f7f6f3",
    color: "#232220",
    padding: "48px 20px 80px",
  } as React.CSSProperties,
  card: {
    maxWidth: 760,
    margin: "0 auto",
    background: "#ffffff",
    border: "1px solid #e4e2dd",
    borderRadius: 14,
    padding: "40px 44px",
    lineHeight: 1.65,
    fontSize: 15,
  } as React.CSSProperties,
  h1: { fontSize: 28, margin: "0 0 6px", letterSpacing: "-0.02em" } as React.CSSProperties,
  updated: { color: "#9c9994", fontSize: 13, margin: "0 0 28px" } as React.CSSProperties,
  h2: { fontSize: 19, margin: "32px 0 10px", letterSpacing: "-0.01em" } as React.CSSProperties,
  h3: { fontSize: 16, margin: "22px 0 8px" } as React.CSSProperties,
  p: { margin: "0 0 12px" } as React.CSSProperties,
  ul: { margin: "0 0 12px", paddingLeft: 22 } as React.CSSProperties,
  footer: { marginTop: 36, paddingTop: 18, borderTop: "1px solid #ececea", color: "#6b6864", fontSize: 13.5 } as React.CSSProperties,
};

export default function PrivacyPage() {
  return (
    <main style={S.page}>
      <article style={S.card}>
        <h1 style={S.h1}>Siplinx AI Privacy Policy</h1>
        <p style={S.updated}>Last updated: July 12, 2026</p>

        <p style={S.p}>
          Siplinx AI is a desktop meeting assistant built on the principle that your
          meeting content should remain private and under your control. This policy
          explains what data we handle, where it is processed, and what never leaves
          your device.
        </p>

        <h2 style={S.h2}>What stays on your device</h2>
        <ul style={S.ul}>
          <li><strong>Audio recordings</strong>: captured and stored locally, never uploaded.</li>
          <li><strong>Transcription</strong>: performed entirely on your device by local speech models.</li>
          <li><strong>Meetings, transcripts and notes</strong>: stored in a local database on your computer. You can export or delete them at any time.</li>
        </ul>

        <h2 style={S.h2}>Account and subscription</h2>
        <p style={S.p}>
          Using the app requires signing in. This is the part of Siplinx AI that
          involves our cloud; your meeting audio never touches it.
        </p>
        <h3 style={S.h3}>Sign-in (Google)</h3>
        <ul style={S.ul}>
          <li>We use Google Sign-In to create your account and receive your <strong>email address, name, profile picture and Google account ID</strong>: nothing else from your Google account.</li>
          <li>We do not receive your Google password and request no access to Gmail, Drive, contacts, or any other Google data.</li>
        </ul>
        <h3 style={S.h3}>Payments (Polar)</h3>
        <ul style={S.ul}>
          <li>Subscriptions are processed by <strong>Polar</strong> as Merchant of Record. Card and billing details are entered on Polar&apos;s checkout and handled by Polar: we never see or store your payment card data.</li>
          <li>We store only your <strong>subscription status</strong> (trial / active / period end) linked to your account, so the app knows whether paid features are unlocked.</li>
        </ul>
        <h3 style={S.h3}>Emails</h3>
        <ul style={S.ul}>
          <li>We may send service emails about your account, trial and subscription.</li>
          <li>Marketing emails are sent only with your explicit consent, which you can withdraw at any time in the app or via the unsubscribe link in any such email.</li>
        </ul>

        <h2 style={S.h2}>Cloud summaries and meeting chat</h2>
        <p style={S.p}>
          Summaries and the meeting chat are generated in the cloud. When you request
          a summary or ask a question about a meeting:
        </p>
        <ul style={S.ul}>
          <li>The meeting transcript is transmitted over <strong>HTTPS</strong> to our server to generate the result using the OpenAI API.</li>
          <li>Transcripts are processed <strong>in-memory only</strong>: we do not log, store, or share them with any third party.</li>
          <li>OpenAI&apos;s handling of submitted data is governed by <a href="https://openai.com/policies/service-terms">OpenAI&apos;s Service Terms</a>.</li>
        </ul>

        <h2 style={S.h2}>Usage analytics</h2>
        <p style={S.p}>
          To improve the product we collect minimal, anonymized usage data. Analytics
          is optional and can be turned off in Settings at any time.
        </p>
        <h3 style={S.h3}>What we collect</h3>
        <ul style={S.ul}>
          <li>Feature usage patterns, session duration and frequency.</li>
          <li>Performance metrics and anonymized error reports.</li>
          <li>Application version and platform information.</li>
        </ul>
        <h3 style={S.h3}>What we never collect</h3>
        <ul style={S.ul}>
          <li>Meeting content, transcripts, notes or recordings.</li>
          <li>File names, meeting titles or participant names.</li>
          <li>Audio data or voice patterns.</li>
        </ul>
        <h3 style={S.h3}>How it works</h3>
        <ul style={S.ul}>
          <li><strong>Provider</strong>: PostHog (EU region).</li>
          <li><strong>Anonymization</strong>: data is linked to a randomly generated user ID only. You can view and copy this ID in Settings to help us investigate issues you report.</li>
          <li><strong>Encryption</strong>: all data is encrypted in transit.</li>
        </ul>

        <h2 style={S.h2}>Your rights</h2>
        <ul style={S.ul}>
          <li><strong>Access and export</strong>: your meeting data lives on your device; export it in standard formats at any time.</li>
          <li><strong>Deletion</strong>: delete meetings locally at any time. To delete your account and the subscription record linked to it, contact us.</li>
          <li><strong>Opt-out</strong>: disable analytics and marketing emails in Settings.</li>
        </ul>

        <h2 style={S.h2}>Changes to this policy</h2>
        <p style={S.p}>
          We will notify users of material changes through release notes and in-app
          notifications. The current version of this policy is always available at
          this address.
        </p>

        <h2 style={S.h2}>Contact</h2>
        <p style={S.p}>
          For privacy-related questions or requests:{" "}
          <a href="mailto:hello@siplinx.com">hello@siplinx.com</a>
        </p>

        <footer style={S.footer}>Siplinx AI</footer>
      </article>
    </main>
  );
}
