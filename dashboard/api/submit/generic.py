"""Fallback adapter: open the posting, screenshot, and hand back to the human."""

HOSTS: tuple[str, ...] = ()


def login_url() -> str:
    return "about:blank"


def is_logged_in(page) -> bool:
    return True


def submit(page, ctx):
    from . import SubmitError

    ctx.step("open")
    page.goto(ctx.url, wait_until="domcontentloaded")
    ctx.shots.shot(page, "posting")
    raise SubmitError("manual_required", f"no adapter for {ctx.url}; apply manually")
