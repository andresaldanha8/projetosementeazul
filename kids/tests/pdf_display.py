"""Expected display values for PDF cell comparisons."""
def display_phone(value):
    digits = ''.join(c for c in value if c.isascii() and c.isdigit())
    local = digits[2:] if len(digits) == 13 and digits.startswith('55') else digits
    if len(local) == 11:
        return f'({local[:2]}) {local[2:7]}-{local[7:]}'
    if len(local) == 10:
        return f'({local[:2]}) {local[2:6]}-{local[6:]}'
    return value
