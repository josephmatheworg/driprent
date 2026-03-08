import { Layout } from '@/components/layout/Layout';
import { Search, Send, MessageSquare, UserCheck, CreditCard, RotateCcw, Camera, ListChecks, ShieldCheck, AlertTriangle, Info } from 'lucide-react';

const renterSteps = [
  { icon: Search, title: 'Browse Outfits', desc: 'Browse outfits and choose the one you like.' },
  { icon: Send, title: 'Send Request', desc: 'Send a rental request to the owner.' },
  { icon: ListChecks, title: 'Wait for Approval', desc: 'Wait for the owner to accept your request.' },
  { icon: MessageSquare, title: 'Chat & Agree', desc: 'Once accepted, chat with the owner to discuss rental price, security deposit, pickup or delivery, and return date.' },
  { icon: UserCheck, title: 'Show Your ID', desc: 'Show your ID when meeting the owner so they can verify your identity.' },
  { icon: CreditCard, title: 'Pay Directly', desc: 'Pay the agreed rental amount and security deposit directly to the owner.' },
  { icon: RotateCcw, title: 'Return on Time', desc: 'Return the outfit on time and in good condition.' },
  { icon: ShieldCheck, title: 'Get Deposit Back', desc: 'After returning the outfit, the owner should return your security deposit.' },
];

const lenderSteps = [
  { icon: Camera, title: 'List Your Outfit', desc: 'List your outfit with clear photos and details.' },
  { icon: ListChecks, title: 'Review Requests', desc: 'When a user sends a rental request, review their profile before accepting.' },
  { icon: MessageSquare, title: 'Chat & Agree', desc: 'Once you accept, chat with the renter to discuss rental price, security deposit, pickup or delivery, and return date.' },
  { icon: UserCheck, title: 'Verify Identity', desc: 'Ask the renter to show a valid ID when handing over the outfit.' },
  { icon: CreditCard, title: 'Collect Payment', desc: 'Collect the rental payment and security deposit before giving the outfit.' },
  { icon: ShieldCheck, title: 'Return Deposit', desc: 'Only return the security deposit after the outfit is returned in good condition.' },
  { icon: Search, title: 'Inspect on Return', desc: 'Inspect the outfit when it is returned.' },
];

const safetyTips = [
  'Always verify the other person\'s identity before exchanging items.',
  'Always agree on a security deposit before renting.',
  'Do not hand over outfits without receiving the agreed payment and deposit.',
  'Return outfits on time and in the same condition.',
  'Communicate clearly through the chat system.',
];

export default function HowItWorks() {
  return (
    <Layout>
      {/* Header */}
      <section className="bg-card py-16 text-center">
        <div className="container mx-auto px-4">
          <h1 className="font-display text-5xl text-foreground md:text-6xl">HOW DRIPRENT WORKS</h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            DripRent connects renters and outfit owners. Payments and exchanges are handled directly between users.
          </p>
        </div>
      </section>

      {/* For Renters */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <h2 className="mb-10 text-center font-display text-4xl text-foreground">FOR RENTERS</h2>
          <div className="mx-auto grid max-w-5xl gap-4 md:grid-cols-2">
            {renterSteps.map((step, i) => (
              <div key={i} className="flex items-start gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <step.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">{step.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* For Lenders */}
      <section className="bg-card py-16">
        <div className="container mx-auto px-4">
          <h2 className="mb-10 text-center font-display text-4xl text-foreground">FOR OUTFIT OWNERS</h2>
          <div className="mx-auto grid max-w-5xl gap-4 md:grid-cols-2">
            {lenderSteps.map((step, i) => (
              <div key={i} className="flex items-start gap-4 rounded-2xl border border-border bg-background p-5 shadow-sm transition-shadow hover:shadow-md">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <step.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">{step.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Safety Tips */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl rounded-2xl border-2 border-destructive/20 bg-destructive/5 p-8">
            <div className="mb-6 flex items-center gap-3">
              <AlertTriangle className="h-6 w-6 text-destructive" />
              <h2 className="font-display text-3xl text-foreground">IMPORTANT SAFETY TIPS</h2>
            </div>
            <ul className="space-y-3">
              {safetyTips.map((tip, i) => (
                <li key={i} className="flex items-start gap-3 text-foreground">
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Disclaimer */}
      <section className="border-t border-border py-10">
        <div className="container mx-auto px-4">
          <div className="mx-auto flex max-w-3xl items-start gap-3 text-sm text-muted-foreground">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              DripRent only connects renters and outfit owners. Payments, deposits, and exchanges are handled directly between users. Users are responsible for verifying identities and agreeing on rental terms.
            </p>
          </div>
        </div>
      </section>
    </Layout>
  );
}
