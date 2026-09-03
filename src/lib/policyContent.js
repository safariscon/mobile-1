export const POLICY_TAB_KEYS = [
  { key: 'how-it-works', labelKey: 'policy.tabs.howItWorks', shortKey: 'policy.tabs.howItWorksShort', icon: 'compass' },
  { key: 'terms', labelKey: 'policy.tabs.terms', shortKey: 'policy.tabs.termsShort', icon: 'file-text' },
  { key: 'privacy', labelKey: 'policy.tabs.privacy', shortKey: 'policy.tabs.privacyShort', icon: 'shield' },
  { key: 'payments', labelKey: 'policy.tabs.payments', shortKey: 'policy.tabs.paymentsShort', icon: 'credit-card' },
];

/** @deprecated use POLICY_TAB_KEYS */
export const POLICY_TABS = POLICY_TAB_KEYS.map(({ key, labelKey }) => ({ key, label: labelKey }));

export const SUPPORT_CONTACT = {
  email: 'info@safariscon.rw',
  phone: '+250 788 000 000',
};

function accountsSection(t) {
  return {
    title: t('policy.accountsTitle'),
    items: t('policy.accountsItems', { returnObjects: true }),
  };
}

export function buildPolicyContent(t) {
  return {
    'how-it-works': {
      title: t('policy.howTitle'),
      lead: t('policy.howLead'),
      steps: [1, 2, 3, 4, 5, 6].map((n) => ({
        title: t(`policy.howStep${n}Title`),
        body: t(`policy.howStep${n}Body`),
      })),
      sections: [accountsSection(t)],
      footer: t('policy.defaultCancelNote'),
    },
    terms: {
      title: t('policy.termsTitle'),
      lead: t('policy.termsLead'),
      sections: [
        {
          title: t('policy.forGuests'),
          items: t('policy.guestTerms', { returnObjects: true }),
        },
        {
          title: t('policy.forProviders'),
          items: t('policy.providerTerms', { returnObjects: true }),
        },
        {
          title: t('policy.platform'),
          items: t('policy.platformTerms', { returnObjects: true }),
        },
        accountsSection(t),
      ],
    },
    privacy: {
      title: t('policy.privacyTitle'),
      lead: t('policy.privacyLead'),
      table: {
        title: t('policy.collectTitle'),
        rows: t('policy.collectRows', { returnObjects: true }),
      },
      sections: [
        {
          title: t('policy.notTitle'),
          items: t('policy.notItems', { returnObjects: true }),
        },
        {
          title: t('policy.hiddenTitle'),
          items: [t('policy.hiddenBody')],
        },
        {
          title: t('policy.processorsTitle'),
          items: t('policy.processorItems', { returnObjects: true }),
        },
        {
          title: t('policy.controlsTitle'),
          items: [t('policy.controlsBody', { email: SUPPORT_CONTACT.email })],
        },
        {
          title: t('policy.securityTitle'),
          items: [t('policy.securityBody')],
        },
      ],
    },
    payments: {
      title: t('policy.paymentsTitle'),
      lead: t('policy.paymentsLead'),
      highlight: t('policy.paymentsHighlight'),
      sections: [
        {
          title: t('policy.payingTitle'),
          items: [1, 2, 3, 4, 5].map((n) => t(`policy.pay${n}`)),
        },
        {
          title: t('policy.afterPayTitle'),
          items: [t('policy.afterPayBody')],
        },
        {
          title: t('policy.cancellationTitle'),
          items: [t('policy.cancellationBody')],
        },
        {
          title: t('policy.moneyTitle'),
          items: [1, 2, 3].map((n) => t(`policy.money${n}`)),
        },
        {
          title: t('policy.atVenueTitle'),
          items: [t('policy.atVenueBody')],
        },
      ],
    },
  };
}

export function buildCheckboxCopy(t) {
  return {
    register: t('policy.checkboxRegister'),
    booking: t('policy.checkboxBooking'),
  };
}

export function buildAcceptBar(t) {
  return {
    title: t('policy.acceptTitle'),
    body: t('policy.acceptBody'),
    accept: t('policy.acceptButton'),
    decline: t('policy.declineButton'),
  };
}