from datetime import datetime, timedelta, timezone


def utcnow():
    return datetime.now(timezone.utc)


def today():
    """Today's date as a timezone-aware datetime at midnight UTC."""
    return utcnow().replace(hour=0, minute=0, second=0, microsecond=0)


def days_until(date_value):
    """Whole days from today until the given date (minimum 0)."""
    if date_value is None:
        return None
    if isinstance(date_value, datetime):
        target = date_value.date()
    else:
        target = date_value
    delta = target - today().date()
    return max(delta.days, 0)


def parse_date(value, field_name="date"):
    """Parse a YYYY-MM-DD string into an aware datetime (midnight UTC)."""
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    try:
        parsed = datetime.strptime(str(value)[:10], "%Y-%m-%d")
    except ValueError:
        raise ValueError(f"{field_name} must be in YYYY-MM-DD format")
    return parsed.replace(tzinfo=timezone.utc)


def parse_time(value):
    """Parse a HH:MM string into minutes since midnight."""
    hours, minutes = str(value).strip().split(":")[:2]
    total = int(hours) * 60 + int(minutes)
    if total < 0 or total >= 24 * 60:
        raise ValueError("time must be between 00:00 and 23:59")
    return total


def format_time(total_minutes):
    """Format minutes since midnight as HH:MM."""
    total_minutes = int(round(total_minutes)) % (24 * 60)
    return f"{total_minutes // 60:02d}:{total_minutes % 60:02d}"


def format_date(date_value):
    """Format a datetime/date as YYYY-MM-DD."""
    if date_value is None:
        return None
    if isinstance(date_value, datetime):
        return date_value.date().isoformat()
    return date_value.isoformat()


def format_clock(total_minutes):
    """Format minutes since midnight as a 12-hour clock string (e.g. 6:00 PM)."""
    total_minutes = int(round(total_minutes)) % (24 * 60)
    hours, minutes = divmod(total_minutes, 60)
    period = "AM" if hours < 12 else "PM"
    display = hours % 12 or 12
    return f"{display}:{minutes:02d} {period}"


def serialize_value(value):
    """Convert field values into JSON-friendly primitives."""
    if hasattr(value, "to_dict"):
        return value.to_dict()
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, timedelta):
        return int(value.total_seconds())
    return value
