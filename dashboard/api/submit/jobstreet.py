"""JobStreet (SEEK platform: my/sg/id/ph.jobstreet.com) adapter.
Selectors are SEEK data-automation anchors observed at build time; pin them with
`playwright codegen` when the flow drifts."""

import re

HOSTS = ("jobstreet.com", "jobstreet.com.my", "jobstreet.com.sg", "jobstreet.co.id", "jobstreet.com.ph",
         "jobstreet.vn", "jobsdb.com")
LOGIN_URL = "https://my.jobstreet.com/oauth/login/"
MAX_STEPS = 8

SEL_ACCOUNT = "[data-automation='account-name'], [data-automation='user-avatar'], a[href*='/profile']"
SEL_APPLY = "[data-automation='job-detail-apply'], a:has-text('Quick apply'), a:has-text('Apply')"
SEL_APPLIED = "[data-automation='job-detail-applied'], :text('You applied')"
SEL_CLOSED = ":text('This job is no longer advertised'), :text('no longer accepting')"
SEL_FILE = "input[type='file']"
SEL_RESUME_UPLOAD = "[data-testid='resume-method-upload'], label:has-text('Upload a resumé'), label:has-text('Upload a resume')"
SEL_COVER_WRITE = "[data-testid='coverLetter-method-change'], label:has-text('Write a cover letter')"
SEL_COVER_TEXT = "textarea[data-testid='coverLetterTextInput'], textarea[name='coverLetter']"
SEL_CONTINUE = "[data-testid='continue-button'], button:has-text('Continue')"
SEL_SUBMIT = "[data-testid='review-submit-application'], button:has-text('Submit application')"
SEL_SENT = ":text('application has been submitted'), :text('Application sent'), [data-testid='application-success']"
SEL_QUESTION = "[data-testid^='question-'], fieldset, .question"
SEL_ERROR = "[role='alert'], .error-message"


def login_url() -> str:
    return LOGIN_URL


def is_logged_in(page) -> bool:
    if "/oauth/login" in page.url or "/login" in page.url:
        return False
    return page.locator(SEL_ACCOUNT).count() > 0


def _norm(label: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[*:]", "", label)).strip().lower()


def _cover_text(ctx) -> str:
    try:
        from pypdf import PdfReader
        return "\n".join((p.extract_text() or "") for p in PdfReader(str(ctx.cover_pdf)).pages).strip()
    except Exception:  # noqa: BLE001 - fall back to uploading nothing
        return ""


def _answer_questions(page, ctx) -> list[str]:
    unanswered = []
    for q in page.locator(SEL_QUESTION).all():
        label_el = q.locator("legend, label, strong").first
        if not label_el.count():
            continue
        key = _norm(label_el.inner_text())
        answer = ctx.answers.get(key) or next((v for k, v in ctx.answers.items() if k and k in key), None)
        inp = q.locator("input[type='text'], input[type='number'], textarea").first
        sel = q.locator("select").first
        options = q.locator("input[type='radio'], input[type='checkbox']")
        if inp.count():
            if inp.input_value().strip():
                continue
            if answer is None:
                unanswered.append(key)
            else:
                inp.fill(answer)
        elif sel.count():
            if answer is None:
                unanswered.append(key)
            else:
                sel.select_option(label=answer)
        elif options.count():
            if answer is None:
                unanswered.append(key)
            else:
                q.locator(f"label:has-text('{answer}')").first.click()
    return unanswered


def submit(page, ctx):
    from . import SubmitError

    ctx.step("open")
    page.goto(ctx.url, wait_until="domcontentloaded")
    page.wait_for_timeout(2000)
    if not is_logged_in(page):
        raise SubmitError("not_logged_in", "run /browser/login for jobstreet first")
    ctx.shots.shot(page, "posting")
    if page.locator(SEL_APPLIED).count():
        raise SubmitError("already_applied")
    if page.locator(SEL_CLOSED).count():
        raise SubmitError("job_closed")
    btn = page.locator(SEL_APPLY).first
    if not btn.count():
        raise SubmitError("selector_not_found", "apply button")
    href = btn.get_attribute("href") or ""
    if href and "jobstreet" not in href and "seek" not in href:
        raise SubmitError("external_apply", href)
    ctx.step("apply")
    btn.click()
    page.wait_for_load_state("domcontentloaded")

    for i in range(MAX_STEPS):
        if ctx.cancelled:
            raise SubmitError("cancelled")
        ctx.step(f"form-step-{i + 1}")
        page.wait_for_timeout(1500)
        if page.locator(SEL_RESUME_UPLOAD).count():
            page.locator(SEL_RESUME_UPLOAD).first.click()
            page.locator(SEL_FILE).first.set_input_files(str(ctx.cv_pdf))
            ctx.step("upload-cv")
            page.wait_for_timeout(3000)
        if page.locator(SEL_COVER_WRITE).count():
            page.locator(SEL_COVER_WRITE).first.click()
            text = _cover_text(ctx)
            if text and page.locator(SEL_COVER_TEXT).count():
                page.locator(SEL_COVER_TEXT).first.fill(text[:4000])
                ctx.step("cover-letter")
        unanswered = _answer_questions(page, ctx)
        ctx.shots.shot(page, f"step-{i + 1}")
        if unanswered:
            raise SubmitError("unanswered_question", "; ".join(unanswered) + " (add to dashboard/apply-answers.yaml)")
        if page.locator(SEL_SUBMIT).count():
            ctx.shots.shot(page, "review")
            if ctx.dry_run:
                return {"outcome": "dry_run_ok"}
            ctx.step("submit")
            page.locator(SEL_SUBMIT).first.click()
            try:
                page.locator(SEL_SENT).first.wait_for(timeout=20_000)
            except Exception as exc:
                raise SubmitError("submit_unconfirmed", "clicked submit, no confirmation seen; verify on JobStreet") from exc
            ctx.shots.shot(page, "confirmation")
            return {"outcome": "submitted", "confirmation_text": "application submitted"}
        nxt = page.locator(SEL_CONTINUE).first
        if not nxt.count():
            raise SubmitError("selector_not_found", "continue button")
        nxt.click()
        if page.locator(SEL_ERROR).count():
            raise SubmitError("unanswered_question", page.locator(SEL_ERROR).first.inner_text()[:200])
    raise SubmitError("selector_not_found", f"more than {MAX_STEPS} form steps")
