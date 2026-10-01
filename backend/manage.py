#!/usr/bin/env python
import os
import sys


def main():
    # The test suite runs against an in-memory MongoDB (mongomock),
    # so real user data is never touched.
    if len(sys.argv) > 1 and sys.argv[1] == "test":
        os.environ.setdefault("DJANGO_TESTING", "1")

    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django. Make sure the virtual environment is "
            "activated and requirements are installed."
        ) from exc

    execute_from_command_line(sys.argv)


if __name__ == "__main__":
    main()
