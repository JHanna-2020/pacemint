import { ArrowRight, Bot, ChartNoAxesColumnIncreasing, KeyRound, Sparkles, X } from 'lucide-react';

type Props = {
  onClose: () => void;
};

const highlights = [
  {
    icon: ChartNoAxesColumnIncreasing,
    title: 'Choose your budget period',
    body: 'Use calendar months or custom statement cycles, then add expenses and income without losing context.'
  },
  {
    icon: Sparkles,
    title: 'Stay ahead of category pressure',
    body: 'Category budgets, spending bars, and auto allocation help you see where money is going.'
  },
  {
    icon: Bot,
    title: 'Ask the AI budget chatbot',
    body: 'Use the OpenRouter-powered chat for spending questions. Free model availability may vary.'
  },
  {
    icon: KeyRound,
    title: 'Save your recovery code',
    body: 'Your budget data is encrypted. Keep your recovery code because it is required if you forget your password.'
  }
];

export function ProductOnboarding({ onClose }: Props) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="onboarding-modal" role="dialog" aria-modal="true" aria-labelledby="product-onboarding-title">
        <button className="icon-button modal-close" type="button" aria-label="Close onboarding" onClick={onClose}>
          <X size={18} />
        </button>
        <div className="onboarding-modal-copy">
          <p className="eyebrow">Welcome to PaceMint</p>
          <h1 id="product-onboarding-title">A quick tour before you budget.</h1>
          <p>
            PaceMint is built around one question: what is safe to spend for the rest of your budget period? Here are the main
            tools to know.
          </p>
        </div>
        <div className="onboarding-highlights">
          {highlights.map((item) => {
            const Icon = item.icon;
            return (
              <article key={item.title}>
                <Icon size={20} />
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.body}</p>
                </div>
              </article>
            );
          })}
        </div>
        <button className="primary-button onboarding-modal-action" type="button" onClick={onClose}>
          Continue
          <ArrowRight size={18} />
        </button>
      </section>
    </div>
  );
}
