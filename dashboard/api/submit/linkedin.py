"""LinkedIn Easy Apply adapter. Selectors are constants: when LinkedIn's DOM drifts,
fix them here (every failure ships a screenshot showing what the page looked like)."""

import re

HOSTS = ("linkedin.com",)
LOGIN_URL = "https://www.linkedin.com/login"
MAX_STEPS = 12

SEL_NAV_ME = "nav [data-control-name='nav.settings'], .global-nav__me, img.global-nav__me-photo"
SEL_APPLY_BTN = ".jobs-apply-button, button.jobs-apply-button--top-card, button:has-text('Easy Apply')"
SEL_APPLIED = ".artdeco-inline-feedback--success:has-text('Applied'), span:has-text('Applied')"
SEL_CLOSED = ".jobs-details-top-card__apply-error, span:has-text('No longer accepting applications')"
SEL_MODAL = ".jobs-easy-apply-modal, div[role='dialog']:has(h2:has-text('apply'))"
SEL_FILE = "input[type='file']"
SEL_NEXT = "button[aria-label='Continue to next step'], button[aria-label='Review your application']"
SEL_SUBMIT = "button[aria-label='Submit application']"
SEL_FOLLOW = "input#follow-company-checkbox, label[for='follow-company-checkbox']"
SEL_SENT = "h2:has-text('application was sent'), h3:has-text('application was sent'), :text('Your application was sent')"
SEL_ERROR = ".artdeco-inline-feedback--error"
SEL_CAPTCHA = "iframe[src*='captcha'], #captcha-internal"


def login_url() -> str:
    return LOGIN_URL


def is_logged_in(page) -> bool:
    if "/login" in page.url or "/checkpoint" in page.url or "/authwall" in page.url:
        return False
    return page.locator(SEL_NAV_ME).count() > 0


def _norm(label: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[*:]", "", label)).strip().lower()


def _fill_step(page, ctx) -> list[str]:
    """Fill required fields on the current modal step from ctx.answers. Returns unanswered labels."""
    modal = page.locator(SEL_MODAL).first
    unanswered = []
    # resume upload
    if modal.locator(SEL_FILE).count() and modal.locator("text=/resume|cv/i").count():
        modal.locator(SEL_FILE).first.set_input_files(str(ctx.cv_pdf))
        ctx.step("upload-cv")
    # text inputs / selects / radios by label
    for group in modal.locator("div.fb-dash-form-element, .jobs-easy-apply-form-element, [data-test-form-element]").all():
        label_el = group.locator("label, legend, span[aria-hidden='true']").first
        if not label_el.count():
            continue
        key = _norm(label_el.inner_text())
        answer = ctx.answers.get(key) or next((v for k, v in ctx.answers.items() if k and k in key), None)
        inp = group.locator("input:not([type='file']):not([type='radio']):not([type='checkbox']), textarea").first
        sel = group.locator("select").first
        radios = group.locator("input[type='radio']")
        if inp.count():
            if inp.input_value().strip():
                continue
            if answer is None:
                unanswered.append(key)
            else:
                inp.fill(answer)
        elif sel.count():
            if answer is None:
                if (sel.input_value() or "").lower() in ("", "select an option"):
                    unanswered.append(key)
            else:
                sel.select_option(label=answer)
        elif radios.count():
            if answer is None:
                if not radios.filter(has=page.locator(":checked")).count():
                    unanswered.append(key)
            else:
                group.locator(f"label:has-text('{answer}')").first.click()
    return unanswered


def submit(page, ctx):
    from . import SubmitError

    ctx.step("open")
    page.goto(ctx.url, wait_until="domcontentloaded")
    page.wait_for_timeout(2000)
    if page.locator(SEL_CAPTCHA).count():
        raise SubmitError("captcha", page.url)
    if not is_logged_in(page):
        raise SubmitError("not_logged_in", "run /browser/login for linkedin first")
    ctx.shots.shot(page, "posting")
    if page.locator(SEL_APPLIED).count():
        raise SubmitError("already_applied")
    if page.locator(SEL_CLOSED).count():
        raise SubmitError("job_closed")
    btn = page.locator(SEL_APPLY_BTN).first
    if not btn.count():
        raise SubmitError("selector_not_found", "apply button")
    if "easy apply" not in btn.inner_text().strip().lower():
        raise SubmitError("external_apply", "posting redirects to the employer site")
    ctx.step("easy-apply")
    btn.click()
    page.locator(SEL_MODAL).first.wait_for()

    for i in range(MAX_STEPS):
        if ctx.cancelled:
            raise SubmitError("cancelled")
        ctx.step(f"form-step-{i + 1}")
        unanswered = _fill_step(page, ctx)
        ctx.shots.shot(page, f"step-{i + 1}")
        if unanswered:
            raise SubmitError("unanswered_question", "; ".join(unanswered) + " (add to dashboard/apply-answers.yaml)")
        if page.locator(SEL_SUBMIT).count():
            follow = page.locator(SEL_FOLLOW).first
            if follow.count():
                try:
                    if follow.is_checked():
                        follow.click()
                except Exception:  # noqa: BLE001 - label vs input; cosmetic
                    pass
            ctx.shots.shot(page, "review")
            if ctx.dry_run:
                return {"outcome": "dry_run_ok"}
            ctx.step("submit")
            page.locator(SEL_SUBMIT).first.click()
            try:
                page.locator(SEL_SENT).first.wait_for(timeout=15_000)
            except Exception as exc:
                raise SubmitError("submit_unconfirmed", "clicked submit, no confirmation seen; verify on LinkedIn") from exc
            ctx.shots.shot(page, "confirmation")
            return {"outcome": "submitted", "confirmation_text": "Your application was sent"}
        nxt = page.locator(SEL_NEXT).first
        if not nxt.count():
            raise SubmitError("selector_not_found", "next/review button")
        nxt.click()
        page.wait_for_timeout(1200)
        if page.locator(SEL_ERROR).count():
            raise SubmitError("unanswered_question", page.locator(SEL_ERROR).first.inner_text()[:200])
    raise SubmitError("selector_not_found", f"more than {MAX_STEPS} form steps")
