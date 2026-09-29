# Email delivery boundary

Authentication uses the `EmailSender` application port. Template rendering is deterministic and side-effect free in `EmailTemplateRenderer.ts`; it does not call an external provider or log secrets.

Production delivery must be implemented as an asynchronous provider worker (for example SES or SMTP behind a queue/outbox). Provider credentials belong in AWS Secrets Manager/SSM, never source code or images. The worker must retain notification idempotency keys, bounded retries, and server-authoritative delivery timestamps.

The current application deliberately keeps the development console sender and does not perform synchronous provider calls during registration or other business transactions.
