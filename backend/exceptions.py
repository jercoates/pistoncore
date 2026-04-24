"""
PistonCore Compiler Exceptions
"""


class CompilerError(Exception):
    """
    Raised for unrecoverable compiler problems.
    Message must be plain English — never a stack trace.
    This surfaces directly in the PistonCore UI validation banner.
    """
    pass


class CompilerWarning:
    """
    Non-fatal compiler notice. Compilation continues.
    Collected and returned alongside the compiled output.
    Displayed in the validation banner after save.
    """
    def __init__(self, message: str):
        self.message = message

    def __repr__(self):
        return f"CompilerWarning({self.message!r})"
