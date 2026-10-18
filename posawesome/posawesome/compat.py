"""Frappe v15/v16 differences.

Each helper detects what the running Frappe does rather than reading its
version, and on v15 returns exactly what the code used before.
"""

from functools import cache
from importlib.util import find_spec


@cache
def _get_list_uses_query_engine():
    # v16 routes frappe.get_list/get_all through frappe.model.qb_query, whose query
    # engine rejects SQL functions written as strings; v15 (db_query) has no such module.
    return find_spec("frappe.model.qb_query") is not None


def aggregate_field(function, column, alias):
    """A `<function>(<column>) as <alias>` field for frappe.get_all/get_list,
    in the syntax this Frappe accepts."""
    if _get_list_uses_query_engine():
        return {function.upper(): column, "as": alias}
    return f"{function}({column}) as {alias}"
