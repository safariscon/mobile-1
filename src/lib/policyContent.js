export const POLICY_TABS = [
  { key: 'how-it-works', label: 'How it works' },
  { key: 'terms', label: 'Terms of use' },
  { key: 'privacy', label: 'Privacy' },
  { key: 'payments', label: 'Payments & refunds' },
];

export const SUPPORT_CONTACT = {
  email: 'info@safariscon.rw',
  phone: '+250 788 000 000',
};

export const CHECKBOX_COPY = {
  register: 'I accept the Terms of use and Privacy policy.',
  booking: 'I agree to the Terms and Payments & refunds. Provider details unlock only after you pay the full amount. Money is held until the cancel window ends.',
};

export const ACCEPT_BAR = {
  title: 'Accept to continue',
  body: 'You must accept the Terms of use and Privacy policy before using bookings, payments, or dashboards.',
  accept: 'I accept Terms and Privacy',
  decline: 'Decline and sign out',
};

const ACCOUNTS_SIGNIN = {
  title: 'Accounts and sign-in',
  items: [
    'Guests create their own account with name, email, and password.',
    'Hotels and other providers do not self-register. SafarisCon invites them; they finish onboarding, set a password, and add payout details before they can collect payments.',
    'After sign-up we email a 6-digit code (about 10 minutes). Login is email + password, then a one-time login code. We protect accounts with email verification and a login code, not password-only access. Passwords are stored hashed. Remember me issues a refresh token for about one day. Log out ends that session.',
  ],
};

export const POLICY_CONTENT = {
  'how-it-works': {
    title: 'How SafarisCon works',
    lead: 'SafarisCon is a booking marketplace. You pay in the app. We hold the money, protect provider details until you pay, and only then you get what you need to travel.',
    steps: [
      {
        title: 'Browse safely',
        body: 'Public listings hide the provider’s real name, phone, and exact address. You see category, area, photos, and price.',
      },
      {
        title: 'Create an account',
        body: 'Email and password, then we verify your email with a one-time code. Login is password plus a code we email you.',
      },
      {
        title: 'Request a booking',
        body: 'Some listings confirm automatically; others wait for the provider. Either way, you pay the full price in the app — not a 30% deposit, and not cash at the venue.',
      },
      {
        title: 'Pay with Mobile Money or card',
        body: 'Payment goes to the SafarisCon wallet, not straight to the hotel. When payment succeeds, provider details and your booking code unlock.',
      },
      {
        title: 'Cancel only while the window is open',
        body: 'Default: until 6 hours before the service, you can cancel and get 80% back; 20% is a cancellation fee. The listing may set different hours and %. After the deadline, Cancel is hidden and the booking stays valid.',
      },
      {
        title: 'Show your code at the venue',
        body: 'The provider checks it. There is no second payment on arrival.',
      },
    ],
    sections: [ACCOUNTS_SIGNIN],
    footer: 'Each listing shows its own cancel window and fee. Defaults are 6 hours and 20%.',
  },
  terms: {
    title: 'Terms of use',
    lead: 'These terms describe the current SafarisCon product for guests and providers.',
    sections: [
      {
        title: 'For guests',
        items: [
          'You must enter a valid email and complete OTP verification.',
          'You are responsible for the accuracy of booking dates, times, guest counts, and the location fields you submit.',
          'A booking is a contract to pay the displayed full price. Promotions apply only if the listing still has them when you book.',
          'Provider identity is hidden until you pay. Using the app to harvest contacts before payment is not allowed.',
          'After payment you receive a booking code. Bring it (or the QR / receipt) to the venue.',
          'Cancellation is only inside the window on that booking. After that, no refund through this cancel button.',
          'SafarisCon is the marketplace and payment holder. The stay / activity is performed by the listed provider.',
        ],
      },
      {
        title: 'For providers',
        items: [
          'Listings go public after SafarisCon approval. Admin sets your commission; guests never see that number.',
          'You must save MoMo or bank payout details before customers can pay you.',
          'You may set cancel window hours and cancel penalty % on the listing (defaults 6 hours / 20%).',
          'Guest money is held until the cancel window ends (or the guest cancels in time). You are not paid the moment they pay.',
          'If the guest cancels in time, you receive your share of the cancellation fee, not the full booking.',
          'If they do not cancel, you receive your share of the full booking after the window, once SafarisCon confirms the payout.',
          'Completing a booking means verifying the code only — do not collect a second cash amount.',
          'Do not put payout account numbers on the public service form.',
        ],
      },
      {
        title: 'Platform',
        items: [
          'We may refuse or suspend accounts that abuse OTP, payments, or listings.',
          'Payment methods come from the live catalog. Do not assume a single telco.',
          'Commission, default cancel window, and default penalty can differ per listing / business.',
        ],
      },
      ACCOUNTS_SIGNIN,
    ],
  },
  privacy: {
    title: 'Privacy policy — how we handle your data',
    lead: 'We use your details to run accounts, bookings, receipts, and payments. We do not sell personal data.',
    table: {
      title: 'What we collect',
      headers: ['Data', 'Why'],
      rows: [
        ['Name, email, phone', 'Account, booking contact, receipts, OTP login'],
        ['Password', 'Sign-in only (stored hashed)'],
        ['Booking dates, times, guest counts, destination', 'To create and fulfil the booking'],
        ['Your location fields', 'Required on booking requests so the provider can plan the service'],
        ['Payment name, email, and MoMo number (or card checkout)', 'To collect the booking amount'],
        ['Provider MoMo / bank payout details', 'To pay the provider after the cancel window — not shown to guests'],
        ['Listing photos', 'Shown on the marketplace'],
        ['Product analytics', 'Page views and booking events. We store a hashed IP, device type, and browser — not a raw IP in the event record'],
      ],
    },
    sections: [
      {
        title: 'What we do not do',
        items: [
          'We do not sell your personal data.',
          'We do not show other customers your email, phone, or booking.',
          'We do not put the provider’s phone, exact address, or map pin on the public home page.',
          'We do not store your card PIN or MoMo PIN. Card checkout happens on the payment provider’s page. MoMo approval happens on your phone.',
        ],
      },
      {
        title: 'When provider details are hidden vs unlocked',
        items: [
          'Before you pay, listings use an anonymous name. You may see district / area and photos. Phone, exact address, and directions stay locked.',
          'After you pay in full, that booking unlocks provider identity, contact, and location for you. Other users still see the anonymous listing.',
        ],
      },
      {
        title: 'Who else processes data',
        items: [
          'XentriPay — collects MoMo/card payments into the SafarisCon merchant wallet and later pays providers / refunds guests.',
          'Email delivery — OTP and booking messages.',
          'Image hosting — listing and receipt files.',
        ],
      },
      {
        title: 'Your controls',
        items: [
          'Update profile name / phone where the account screen already allows it.',
          'Log out to end the remembered session.',
          'Providers update payout details on the payout-details page.',
          'For account deletion or a data export, contact info@safariscon.rw.',
        ],
      },
      {
        title: 'Security measures',
        items: [
          'HTTPS, hashed passwords, hashed OTPs, Bearer tokens, role checks, CORS, and security headers.',
          'Private booking and pay routes require a signed-in user. You can only pay or cancel your bookings.',
        ],
      },
    ],
  },
  payments: {
    title: 'Payments, cancellations, and refunds',
    lead: 'You pay the full listing price in the app. Money is held in the SafarisCon wallet until the cancel window ends.',
    highlight: 'Paid in full. Show your booking code at the venue. You can cancel until the listed deadline. If you cancel before then, you get your refund minus the listing’s cancellation fee.',
    sections: [
      {
        title: 'Paying for a booking',
        items: [
          'Currency is RWF. Methods: Mobile Money or card.',
          'You pay the full listing price. There is no 30% deposit and no remaining 70% at the venue.',
          'Money is collected into the SafarisCon wallet. The hotel is not paid at that moment.',
          'A listing cannot be paid until the provider has saved valid MoMo or bank payout details.',
        ],
      },
      {
        title: 'After a successful payment',
        items: [
          'The booking is paid in full. Provider details and your booking code / QR / receipt unlock.',
          'You can cancel only until the booking’s cancel deadline.',
        ],
      },
      {
        title: 'Cancellation',
        items: [
          'Only paid bookings can be cancelled for a refund.',
          'The listing sets hours before the service when cancel closes (default 6) and the percent of what you paid that you lose (default 20).',
          'Always use the numbers shown on your booking. Refunds usually arrive after a short processing time.',
        ],
      },
      {
        title: 'What happens to the money',
        items: [
          'Paid, no cancel: after the cancel deadline, SafarisCon pays the provider their share. You visit with your booking code.',
          'Cancel in time: refund = paid − cancellation fee. The refund returns through the payment partner.',
          'Cancel too late: no refund. The booking remains usable at the venue.',
        ],
      },
      {
        title: 'At the venue',
        items: [
          'The provider verifies the booking code. Completing the booking does not charge anything extra.',
        ],
      },
    ],
  },
};
