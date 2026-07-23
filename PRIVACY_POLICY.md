# Meetily Privacy Policy

*Last updated: [Current Date]*

## Our Privacy-First Commitment

Meetily is built on the principle that your meeting data should remain private and under your control. This privacy policy explains how we handle data in our open-source meeting assistant.

## Data Processing Philosophy

### Local-First Processing
- **Meeting transcription**: Processed entirely on your device using local Whisper models
- **Audio recordings**: Never transmitted to external servers
- **Meeting content**: Remains on your infrastructure
- **AI summaries**: Generated locally or through your chosen LLM provider

### Your Data Ownership
- You own all meeting data, transcripts, and recordings
- Data is stored locally on your device
- No vendor lock-in - export your data anytime
- Complete control over data retention and deletion

## Account & Subscription

Using the app requires signing in. This is the only part of Siplinx AI that
involves our cloud; your meetings never touch it.

### Sign-in (Google)
- We use Google Sign-In to create your account. We receive your **email address,
  name, profile picture and Google account ID** — nothing else from your Google account.
- We do **not** receive your Google password and request no access to Gmail,
  Drive, contacts, or any other Google data.

### Payments (Polar)
- Subscriptions are processed by **Polar** as Merchant of Record. Card and billing
  details are entered on Polar's checkout and handled by Polar — we never see or
  store your payment card data.
- We store only your **subscription status** (free / active / period end) linked to
  your account, so the app knows whether PRO features are unlocked.

### What stays local
- Your meeting audio, transcripts, summaries and notes are **never** sent to our
  account or payment servers. Local-first processing is unchanged.

### PRO Cloud Summary (Optional)
PRO subscribers may optionally enable cloud-based meeting summaries. When this feature
is **enabled** (default for PRO):

- Your meeting transcript is transmitted over **HTTPS** to our server
  (`siplinx-ai.vercel.app`) to generate summaries and chat answers using the OpenAI API.
- Transcripts are processed **in-memory only** — we do **not** log, store, or share
  them with any third party.
- OpenAI's usage of submitted data is governed by [OpenAI's Service Terms](https://openai.com/policies/service-terms).
- You can **disable** this feature at any time in Settings > Summary Model > Cloud
  Summary. After disabling, all summaries are generated locally on your device.

### Offline use
- After signing in, the app caches your subscription status and continues to work
  offline for a grace period without contacting our servers.

## Usage Analytics

### What We Collect
To improve Meetily and ensure optimal performance, we collect minimal, anonymized usage data:

**Application Usage:**
- Feature usage patterns (which tools you use most)
- Session duration and frequency
- Performance metrics (transcription success rates, error frequencies)
- UI interaction patterns (button clicks, navigation flows)

**Technical Metrics:**
- Application version and platform information
- Error logs and crash reports (anonymized)
- Performance benchmarks (processing times, resource usage)

### What We DON'T Collect
We never collect:
- ❌ Meeting content, transcripts, or recordings
- ❌ Personal information or identifiable data
- ❌ File names, meeting titles, or metadata
- ❌ Audio data or voice patterns
- ❌ Participant names or contact information
- ❌ LLM conversations or AI-generated content

### Why We Collect This Data
This analytics collection is necessary for:
- **Product Quality**: Identifying and fixing bugs that impact user experience
- **Performance Optimization**: Understanding resource usage and system bottlenecks
- **Security**: Detecting potential security issues and vulnerabilities
- **Feature Development**: Making data-driven decisions about new features
- **Open Source Sustainability**: Ensuring the project meets user needs effectively

### Analytics Implementation
- **Provider**: PostHog (privacy-focused analytics platform)
- **Anonymization**: All data linked to generated user IDs only - no personal identification
- **Data retention**: 12 months maximum, then automatically deleted
- **Encryption**: All data encrypted in transit using industry-standard protocols
- **Location**: Data processed in accordance with PostHog's privacy policy
- **Access Control**: Strictly limited to core development team members

## Third-Party Services

### LLM Providers (Optional)
If you choose to use external LLM providers:
- **Anthropic Claude**: Subject to Anthropic's privacy policy
- **Groq**: Subject to Groq's privacy policy
- **Local Ollama**: Processed entirely on your device

### Analytics Service (Optional)
- **PostHog**: Used for usage analytics when enabled
- **Data**: Only anonymized usage patterns, no meeting content
- **Control**: Completely optional and user-controlled

## Your Privacy Rights

### Data Control
- **Access**: View all data stored locally on your device
- **Export**: Export your data in standard formats
- **Delete**: Remove all data from your device


### Analytics Transparency
- **Open source**: Full analytics implementation available for review in our source code
- **Questions**: Contact us for any analytics-related concerns

## Data Security

### Local Security
- Data encrypted at rest using your device's security features
- No transmission of sensitive meeting data
- Standard file system permissions protect your data

### Open Source Transparency
- Full source code available for security review
- Community-audited privacy implementations
- No hidden data collection or tracking

## Changes to This Policy

We will notify users of any material changes to this privacy policy through:
- Updates to this document in our GitHub repository
- Release notes for application updates
- In-app notifications for significant privacy changes

## Contact Us

For privacy-related questions or concerns:
- **GitHub Issues**: [Create an issue](https://github.com/Zackriya-Solutions/meeting-minutes/issues)
- **Email**: [Contact form](https://www.zackriya.com/service-interest-form/)
- **Community**: [Discord](https://discord.gg/crRymMQBFH)

## Open Source Commitment

As an open-source project under MIT license, you can:
- Review our complete privacy implementation
- Modify data handling to meet your requirements
- Deploy entirely on your own infrastructure
- Contribute to privacy improvements

---

*This privacy policy applies to Meetily v0.0.5 and later versions. For enterprise deployments, additional privacy controls may be available.*
