import Link from "next/link"

const sections = [
  ["Using CreatorOS", "CreatorOS provides tools for creating and managing content. Creating an account requires acceptance of these terms. You are responsible for keeping your sign-in details secure, providing accurate account information, and using only accounts and connected services you are authorized to access."],
  ["Your content and permissions", "You retain the rights you hold in the content you upload. You allow the service and the providers used for your requested features to process that content to deliver those features. Upload only material you have permission to use, including any personal data, images, voices, and likenesses. Do not assume generated output is exclusive, copyrightable, or cleared for third-party rights; review the rights needed before publishing."],
  ["Responsible use", "Do not use CreatorOS for unlawful activity, harassment, fraud, impersonation, non-consensual voice or likeness cloning, or infringement of another person's rights. Do not bypass access controls, try to obtain another user's data, misuse credentials, or disrupt the service. Obtain any permissions needed for recordings and connected publishing accounts."],
  ["Review AI output", "AI output may contain errors, bias, or misleading material. You are responsible for checking facts, suitability, permissions, and platform rules before sharing it. Educational, health, legal, and financial content needs appropriate review. The service does not promise that generated material is accurate or that a particular result will be achieved."],
  ["Third-party services and privacy", "Some features rely on external AI, storage, authentication, or publishing services. Their availability and applicable terms may affect those features. Do not upload sensitive or confidential information unless you have permission and have assessed the relevant processing. See the Privacy Policy for information about how account and content data are handled."],
  ["Plans, usage, and availability", "Use only the features and usage limits made available to your account. If a feature requires payment, review the price and any applicable billing or cancellation terms before confirming it. A displayed integration or planned feature does not guarantee its availability. Keep copies of important work; interruptions, failed generation, or unavailable providers can occur."],
  ["Accounts and changes", "Access may be limited when necessary to address misuse, protect users, or maintain the service. Contact the operator through the Contact page about account problems or deletion requests. These terms may be revised; the published version and date identify the current text. Review any new version before accepting it."],
  ["Your legal rights", "These terms do not exclude rights or remedies that applicable law does not allow to be excluded. Any additional contractual details needed for a paid offering should be provided before purchase."],
]

export default function TermsOfServicePage() {
  return (
    <div className="container mx-auto px-6 py-16">
      <article className="max-w-3xl mx-auto space-y-8">
        <h1 className="text-4xl font-bold tracking-tight">Terms of Service</h1>
        <p className="text-muted-foreground">Version 2026-10-09 · Last updated: 9 October 2026</p>
        <p className="text-muted-foreground">Read these terms before creating an account. If you do not accept them, do not register or use the account features.</p>
        {sections.map(([title, text], index) => <section key={title} className="space-y-3"><h2 className="text-xl font-semibold">{index + 1}. {title}</h2><p className="text-muted-foreground leading-relaxed">{text}</p></section>)}
        <p className="text-sm">Related information: <Link href="/privacy" className="text-primary underline">Privacy Policy</Link> · <Link href="/contact" className="text-primary underline">Contact</Link></p>
      </article>
    </div>
  )
}
