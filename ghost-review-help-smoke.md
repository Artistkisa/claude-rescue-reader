# GHOST Review Help Guide Smoke Test

This temporary documentation-only change verifies the PR help guide integration.

Expected behavior:

- A full review creates one collapsed GHOST Review help comment.
- Commenting `@ghost-review help` updates that same comment in place.
- Repeated webhook deliveries do not create duplicate help comments.
- The guide renders Chinese text and emoji as UTF-8 without mojibake.
