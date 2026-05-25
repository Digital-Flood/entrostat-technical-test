# Frontend Design Specification

## Visual Direction

The frontend should use a polished, premium dark security-console aesthetic.

The design should feel:

- Secure
- Minimal
- Focused
- Premium
- Modern
- Calm
- Precise

The interface should avoid bright consumer-app styling, playful visuals, and generic admin-dashboard blandness. It should feel closer to a high-end authentication flow for a security, fintech, crypto, or AI infrastructure product.

---

## Core Aesthetic

### Dark Premium Theme

Use a dark monochromatic palette based on:

- Midnight blue
- Obsidian
- Graphite
- Deep navy
- Muted electric blue accents

Avoid pure black where possible. The background should feel deep and cinematic, but still readable.

---

### Subtle Depth

Use depth through:

- Soft surface contrast
- Fine borders
- Gentle shadows
- Light glass-like layering
- Minimal glow on focused/active states

Glow should be restrained. It should guide attention, not dominate the UI.

---

### Glassmorphism-Inspired Surfaces

Cards and panels should use:

- Dark translucent surfaces
- Thin borders
- Slight inner depth
- Soft elevation
- Subtle background gradients

Avoid heavy blur or exaggerated neumorphism.

---

## Colour Palette

### Base Colours

```txt
Background primary:   #0B1220
Background secondary: #0F172A
Surface primary:      #111827
Surface elevated:     #1E293B
Border subtle:        rgba(148, 163, 184, 0.18)
Border active:        rgba(96, 165, 250, 0.65)
```

### Text Colours

```txt
Text primary:   #E5E7EB
Text secondary: #9CA3AF
Text muted:     #64748B
Text inverse:   #0B1220
```

### Accent Colours

```txt
Primary blue: #2563EB
Soft blue:    #60A5FA
Info blue:    #38BDF8
Success:      #22C55E
Warning:      #FBBF24
Error:        #EF4444
```

Use blue as the main interaction colour. Use green, amber, and red only for semantic feedback.

---

## Typography

Use a clean geometric sans-serif.

Preferred font direction:

- Inter
- System UI fallback
- Modern, neutral, highly legible

### Type Scale

```txt
Page title:     32px / 40px, semibold
Section title:  20px / 28px, medium
Body:           16px / 24px, regular
Body small:     14px / 20px, regular
Caption:        12px / 16px, regular
Label:          12px / 16px, medium, uppercase optional
```

Use strong hierarchy through scale, spacing, and weight rather than decoration.

---

## Layout

### Overall Layout

The app should remain functional as a verification console, but should move away from the current light admin-console look.

Use:

- Dark full-page background
- Centred main content area
- Generous spacing
- Large negative space
- Clear grouping between request, verify, and inbox areas
- Responsive behaviour for smaller screens

### Recommended Structure

```txt
Header
  - Product label
  - Page title
  - Environment/API status

Main area
  - Request OTP panel
  - Verify OTP panel
  - Demo inbox panel
```

The demo OTP inbox should become a side drawer. All demo related content should go in this drawer as well.

---

## Components

### Cards / Panels

Cards should use:

```txt
Background: rgba(15, 23, 42, 0.72)
Border: 1px solid rgba(148, 163, 184, 0.18)
Border radius: 18px–24px
Shadow: soft, dark, low-opacity
```

Cards should feel elevated but not overly glossy.

Hover states may slightly increase border brightness or surface contrast.

---

### Buttons

#### Primary Button

Use for main actions such as “Request OTP” and “Verify OTP”.

```txt
Background: #2563EB
Text: #FFFFFF
Border radius: 10px–12px
Hover: slightly brighter blue
Active: slight scale down
```

#### Secondary Button

Use for actions like “Resend OTP” and “Refresh”.

```txt
Background: transparent or dark elevated surface
Border: subtle slate/blue border
Text: #E5E7EB
Hover: subtle blue border
```

#### Disabled Button

```txt
Opacity: 50–60%
Cursor: not-allowed
No glow
```

---

### Inputs

Inputs should feel precise and security-oriented.

```txt
Background: rgba(15, 23, 42, 0.85)
Border: 1px solid rgba(148, 163, 184, 0.22)
Text: #E5E7EB
Placeholder: #64748B
Border radius: 10px–12px
Focus border: #60A5FA
Focus shadow: subtle blue glow
```

Focus glow should be subtle.

---

### OTP Input

The OTP field should be visually emphasised.

Preferred direction:

- Six separated boxes if practical
- Clear active state
- Paste support
- Keyboard-friendly behaviour
- Subtle focus glow
- Strong readability

OTP boxes:

```txt
Size: 48px–56px
Radius: 10px–12px
Background: rgba(15, 23, 42, 0.9)
Border default: rgba(148, 163, 184, 0.22)
Border focus: rgba(96, 165, 250, 0.75)
Text: #E5E7EB
```

---

### Status Messages

Status messages should be calm and clear.

Success:

```txt
Background: rgba(34, 197, 94, 0.08)
Border: rgba(34, 197, 94, 0.32)
Text: #BBF7D0
```

Error:

```txt
Background: rgba(239, 68, 68, 0.08)
Border: rgba(239, 68, 68, 0.32)
Text: #FECACA
```

Info:

```txt
Background: rgba(56, 189, 248, 0.08)
Border: rgba(56, 189, 248, 0.32)
Text: #BAE6FD
```

Avoid overly loud alert colours.

---

### Demo Inbox

The demo inbox should feel like a secure event/message feed.

Each item should show:

- Email
- OTP code
- Delivery type
- Delivered timestamp
- Expiry timestamp

Use compact elevated cards with clear hierarchy.

OTP code badges should be prominent but not flashy.

---

## Motion

Use motion sparingly with Framer Motion.

Good uses:

- Card fade/slide on initial render
- Button press feedback
- Success/error alert entry
- OTP input focus transitions
- Demo inbox item entry/update
- Loading state transitions

Avoid:

- Large decorative animations
- Constant pulsing
- Excessive glow animation
- Slow cinematic movement

### Motion Values

```txt
Duration: 150ms–300ms
Easing: ease-out
Button active scale: 0.98
Card entrance: opacity + small translateY
```

Motion should make the app feel responsive, not theatrical.

---

## Icons

Use outline-style icons.

Icon style:

```txt
Stroke width: 1.5px–2px
Rounded corners
Simple geometry
Muted slate by default
Blue accent for active/security states
```

Suitable icons:

- Lock
- Shield
- Check circle
- Alert triangle
- Refresh
- Clock
- Info

---

## Accessibility Requirements

The design must preserve usability.

Requirements:

- Maintain strong text contrast.
- Ensure visible focus states.
- Do not rely on colour alone for status.
- Buttons must have clear disabled/loading states.
- Inputs must have labels.
- OTP entry should support keyboard use.
- Layout must remain usable on mobile.

---

## Content Tone

Use concise, calm, security-oriented copy.

Examples:

```txt
Issue a verification code
Submit verification code
Verification complete
The latest OTP has been verified and cannot be reused.
A verification code was sent to noah@example.com.
This code expires shortly.
```

Avoid exaggerated copy such as:

```txt
Success!!!
OTP sent!!!
Oops, something went wrong!
```

---

## Implementation Notes

When applying this design:

- Preserve existing request, resend, verify, and demo inbox functionality.
- Do not change backend behaviour.
- Do not alter API contracts unless explicitly required.
- Prefer reusable UI components.
- Keep Tailwind classes readable.
- Avoid introducing a heavy component library.
- Use Framer Motion only where it improves interaction clarity.
- Keep the UI restrained, premium, and focused.

---

## Design Keywords

Use these as reference terms:

```txt
dark fintech UI
premium security UI
cyber minimalism
cinematic auth UI
dark SaaS dashboard
ambient glassmorphism
subtle glowing interface
futuristic OTP design
modern verification console
moody blue interface
```
