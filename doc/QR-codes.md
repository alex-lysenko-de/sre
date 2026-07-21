Currently Each wristband contains a QR code with the following format:
https://sre-nrw.de?id={id}
Example:
https://sre-nrw.de?id=1
https://sre-nrw.de?id=2
https://sre-nrw.de?id=3

But this approach is not very convenient. 
In the future I would like to implement some more flexible and scalable format like this one:


# QR-Code URL Architecture

## Public QR-Code URLs

Each wristband contains a QR code with the following format:

```text
https://sre-nrw.de/{tenant}/{id}
```

Example:

```text
https://sre-nrw.de/id/101
```

where:

* `tenant` — a two-letter tenant identifier.
* `id` — the wristband number within that tenant.

Initially, the tenant identifier is:

```text
id
```

resulting in URLs such as:

```text
https://sre-nrw.de/id/101
https://sre-nrw.de/id/102
...
```

In the future, the tenant code may be changed to any other two-letter identifier:

```text
https://sre-nrw.de/aa/101
https://sre-nrw.de/bb/101
https://sre-nrw.de/xy/101
```

## Tenant Identifier

A tenant identifier always consists of **exactly two lowercase letters** (`a-z`).

Advantages:

* very short QR-Code URLs;
* clear separation between tenant identifiers and application routes;
* easy routing.

Routing rule:

* first path segment = exactly two lowercase letters → tenant
* otherwise → application command (`/info`, `/preview`, `/login`, `/admin`, `/api`, ...)

## Capacity

Using two lowercase English letters gives:

```text
26 × 26 = 676
```

possible tenant identifiers.

Each tenant has its own independent wristband number space.

676 tenants are considered more than sufficient for the expected lifetime of the application.

## Authentication and Session

After a user logs in, the server stores the user's **tenant identifier** in the authenticated session (or JWT).

For example:

```text
User
 └── tenant = aa
```

From this point on, the tenant is determined exclusively from the authenticated session and **not** from request parameters or headers.

Internal application URLs therefore do not need to contain the tenant:

```text
/edit/101
/delete/101
/history/101
```

The server automatically interprets these requests as:

```text
tenant = aa
id = 101
```

## Scanning a QR Code

The public QR-Code URL is the only place where the tenant must be explicitly present.

Example:

```text
https://sre-nrw.de/bb/101
```

When this URL is opened:

1. the server extracts the tenant (`bb`) and wristband ID (`101`);
2. if the user is not authenticated, authentication is performed first;
3. after authentication, the tenant from the URL is compared with the tenant stored in the user's session.

### Matching tenant

If both tenants match, the user gains access to the wristband and all subsequent operations use the tenant stored in the session:

```text
/edit/101
/history/101
/delete/101
```

### Different tenant

If the tenant from the QR code differs from the tenant stored in the user's session, access is denied and the user is shown an appropriate error page indicating that the wristband belongs to another organization.
