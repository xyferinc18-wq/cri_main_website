<?php
/**
 * contact.php — CRI website form handler
 * Layers of defence (outermost → innermost):
 *   1. HTTPS enforced by .htaccess
 *   2. HTTP method gate (POST only)
 *   3. Origin / Referer check
 *   4. Honeypot field (catches bots that skip reCAPTCHA)
 *   5. Rate limiting (max 5 per hour per session)
 *   6. reCAPTCHA v2 verification (cURL preferred, file_get_contents fallback)
 *   7. Input sanitisation + length limits
 *   8. Email header injection prevention
 *
 * SECRET KEY IS SERVER-SIDE ONLY — never sent to the browser.
 */

// ── Config ────────────────────────────────────────────────────────────────────
// Secret key is loaded from the environment, or from secret.local.php (never committed).
// See secret.local.example.php. Regenerate at https://www.google.com/recaptcha/admin
define('RECAPTCHA_SECRET', getenv('RECAPTCHA_SECRET') ?: (is_file(__DIR__ . '/secret.local.php') ? require __DIR__ . '/secret.local.php' : ''));
define('MAIL_TO',          'sales@crobust.com');
define('MAIL_FROM',        'noreply@crobust.com');
define('SITE_NAME',        'Consolidated Robust Inc.');
define('RATE_LIMIT',       5);    // max submissions per window per session
define('RATE_WINDOW',      3600); // window in seconds (1 hour)

// ── Always return JSON ────────────────────────────────────────────────────────
header('Content-Type: application/json; charset=utf-8');
// Prevent caching of the response
header('Cache-Control: no-store, no-cache, must-revalidate');
header('Pragma: no-cache');

// ── 1. POST only ──────────────────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    exit(json_encode(['ok' => false, 'error' => 'Method not allowed.']));
}

// ── 2. Origin / Referer guard ─────────────────────────────────────────────────
// Browsers always send Origin on cross-origin fetch; if it arrives from a
// third-party domain it's either a bot or a CSRF attempt.
$origin  = $_SERVER['HTTP_ORIGIN']  ?? '';
$referer = $_SERVER['HTTP_REFERER'] ?? '';
$allowed = ['crobust.com', 'www.crobust.com', 'localhost', '127.0.0.1'];
if ($origin !== '') {
    $ok = false;
    foreach ($allowed as $host) {
        if (strpos($origin, $host) !== false) { $ok = true; break; }
    }
    if (!$ok) {
        http_response_code(403);
        exit(json_encode(['ok' => false, 'error' => 'Forbidden.']));
    }
}

// ── 3. Honeypot — bots fill this; real users never see it ────────────────────
if (!empty($_POST['_hp'])) {
    // Silently pretend to succeed — bots shouldn't know they were caught
    http_response_code(200);
    exit(json_encode(['ok' => true, 'message' => 'Thank you! Your message has been sent.']));
}

// ── 4. Session-based rate limiting ───────────────────────────────────────────
if (session_status() === PHP_SESSION_NONE) {
    // Harden the session cookie
    session_set_cookie_params([
        'lifetime' => 0,
        'path'     => '/',
        'secure'   => true,
        'httponly' => true,
        'samesite' => 'Strict',
    ]);
    session_start();
}
$now      = time();
$attempts = $_SESSION['cri_contact_attempts'] ?? [];
// Discard attempts outside the rolling window
$attempts = array_values(array_filter($attempts, fn($t) => ($now - $t) < RATE_WINDOW));
if (count($attempts) >= RATE_LIMIT) {
    http_response_code(429);
    exit(json_encode(['ok' => false, 'error' => 'Too many submissions. Please wait a while and try again.']));
}

// ── 5. reCAPTCHA v2 verification ─────────────────────────────────────────────
$token = trim($_POST['g-recaptcha-response'] ?? '');
if ($token === '') {
    http_response_code(400);
    exit(json_encode(['ok' => false, 'error' => 'Please complete the CAPTCHA before submitting.']));
}

$captcha = verifyRecaptcha($token, $_SERVER['REMOTE_ADDR'] ?? '');
if ($captcha === null) {
    http_response_code(500);
    exit(json_encode(['ok' => false, 'error' => 'CAPTCHA service temporarily unavailable. Please email us directly at ' . MAIL_TO . '.']));
}
if (empty($captcha['success'])) {
    http_response_code(400);
    exit(json_encode(['ok' => false, 'error' => 'CAPTCHA verification failed. Please try again.']));
}

// ── 6. Sanitise & validate inputs ────────────────────────────────────────────

/**
 * General cleaner for email body values.
 */
function clean(string $v): string {
    return htmlspecialchars(strip_tags(trim($v)), ENT_QUOTES, 'UTF-8');
}

/**
 * Extra-safe cleaner for values that appear in email headers.
 * Strips CR, LF, and NUL which are the classic header-injection vectors.
 */
function headerSafe(string $v): string {
    return str_replace(["\r", "\n", "\0", "%0d", "%0a", "%00"], '', clean($v));
}

$nameRaw = substr($_POST['name']    ?? '', 0, 200);
$msgRaw  = substr($_POST['message'] ?? '', 0, 8000);

$name    = headerSafe($nameRaw);   // goes into email headers — must be injection-safe
$email   = filter_input(INPUT_POST, 'email', FILTER_VALIDATE_EMAIL);
$company = clean(substr($_POST['company'] ?? '', 0, 200));
$phone   = clean(substr($_POST['phone']   ?? '', 0, 50));
$service = clean(substr($_POST['service'] ?? '', 0, 100));
$message = clean($msgRaw);

if ($name === '' || !$email || $message === '') {
    http_response_code(400);
    exit(json_encode(['ok' => false, 'error' => 'Please fill in your name, email, and message.']));
}

// ── 7. Build and send email ───────────────────────────────────────────────────
$subject = headerSafe('New Inquiry from ' . $name . ($service ? ' — ' . $service : ''));

$body = "New inquiry received via the crobust.com contact form.\n"
      . str_repeat('-', 52) . "\n"
      . "Name:    {$name}\n"
      . "Company: {$company}\n"
      . "Email:   {$email}\n"
      . "Phone:   {$phone}\n"
      . "Service: {$service}\n"
      . str_repeat('-', 52) . "\n\n"
      . "Message:\n{$message}\n\n"
      . "---\nSent: " . date('Y-m-d H:i:s T') . "\nFrom: crobust.com";

// Build headers with header-injected-safe name
$headers = implode("\r\n", [
    'From: '    . SITE_NAME . ' <' . MAIL_FROM . '>',
    'Reply-To: ' . $name    . ' <' . $email . '>',
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'X-Mailer: PHP/' . phpversion(),
]);

// -f sets the envelope sender — required on GoDaddy to avoid spam-folder routing
$sent = @mail(MAIL_TO, $subject, $body, $headers, '-f' . MAIL_FROM);

// ── 8. Record attempt and respond ─────────────────────────────────────────────
// Record regardless of outcome so rate limiting still applies
$attempts[] = $now;
$_SESSION['cri_contact_attempts'] = $attempts;

if ($sent) {
    $safeMsg = "Thank you, {$name}! Your message has been sent. We\xe2\x80\x99ll get back to you shortly.";
    exit(json_encode(['ok' => true, 'message' => $safeMsg]));
} else {
    http_response_code(500);
    exit(json_encode(['ok' => false, 'error' => 'Email could not be sent right now. Please contact us directly at ' . MAIL_TO . ' or call (632) 8711-1780.']));
}

// ── Helper: reCAPTCHA verification ───────────────────────────────────────────
function verifyRecaptcha(string $token, string $ip): ?array {
    $payload = http_build_query([
        'secret'   => RECAPTCHA_SECRET,
        'response' => $token,
        'remoteip' => $ip,
    ]);

    if (function_exists('curl_init')) {
        $ch = curl_init('https://www.google.com/recaptcha/api/siteverify');
        curl_setopt_array($ch, [
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => $payload,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 10,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_HTTPHEADER     => ['Content-Type: application/x-www-form-urlencoded'],
        ]);
        $raw = curl_exec($ch);
        $err = curl_errno($ch);
        curl_close($ch);
        if ($err || $raw === false) return null;

    } elseif (filter_var(ini_get('allow_url_fopen'), FILTER_VALIDATE_BOOLEAN)) {
        $ctx = stream_context_create(['http' => [
            'method'  => 'POST',
            'header'  => 'Content-Type: application/x-www-form-urlencoded',
            'content' => $payload,
            'timeout' => 10,
        ]]);
        $raw = @file_get_contents('https://www.google.com/recaptcha/api/siteverify', false, $ctx);
        if ($raw === false) return null;

    } else {
        return null;
    }

    $data = json_decode($raw, true);
    return is_array($data) ? $data : null;
}
