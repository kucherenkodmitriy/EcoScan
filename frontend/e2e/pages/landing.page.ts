import { type Page, type Locator } from '@playwright/test';

export class LandingPage {
  readonly page: Page;
  readonly heroSection: Locator;
  readonly contactSection: Locator;
  readonly contactForm: Locator;
  readonly nameInput: Locator;
  readonly emailInput: Locator;
  readonly companyInput: Locator;
  readonly messageTextarea: Locator;
  readonly contactSubmitButton: Locator;
  readonly contactSuccessMessage: Locator;
  readonly ctaButton: Locator;
  readonly footer: Locator;
  readonly footerLinks: Locator;
  readonly demoButton: Locator;
  readonly demoModal: Locator;
  readonly recaptchaNotice: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heroSection = page.locator('.landing-hero');
    this.contactSection = page.locator('section#contact');
    this.contactForm = page.locator('form.landing-form');
    this.nameInput = this.contactForm.locator('input#name');
    this.emailInput = this.contactForm.locator('input#email');
    this.companyInput = this.contactForm.locator('input#company');
    this.messageTextarea = this.contactForm.locator('textarea#message');
    this.contactSubmitButton = this.contactForm.locator('button[type=submit]');
    this.contactSuccessMessage = page.locator('.landing-form-success');
    this.ctaButton = page.locator('.landing-hero-actions').getByRole('button').first();
    this.footer = page.locator('footer.landing-footer');
    this.footerLinks = page.locator('.landing-footer-links a');
    // "Request a Demo" button in hero section
    this.demoButton = page.getByRole('button', { name: /request a demo/i });
    this.demoModal = page.locator('.modal-backdrop');
    this.recaptchaNotice = page.locator('.landing-form-recaptcha');
  }

  async goto() {
    await this.page.goto('/');
  }
}
