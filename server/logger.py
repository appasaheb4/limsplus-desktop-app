import logging
import sys

RESET = "\033[0m"
COLORS = {
    "DEBUG": "\033[36m",  # Cyan
    "INFO": "\033[32m",  # Green
    "WARNING": "\033[33m",  # Yellow
    "ERROR": "\033[31m",  # Red
    "CRITICAL": "\033[41m",  # Red background
}


class ColorFormatter(logging.Formatter):
    def format(self, record):
        log_color = COLORS.get(record.levelname, RESET)
        message = super().format(record)
        return f"{log_color}{message}{RESET}"


def _setup_logger() -> logging.Logger:
    log = logging.getLogger("limsplus.gateway")
    if log.handlers:
        return log
    log.setLevel(logging.DEBUG)
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(
        ColorFormatter("%(asctime)s - %(levelname)s - %(message)s")
    )
    log.addHandler(handler)
    log.propagate = False
    return log


logger = _setup_logger()
