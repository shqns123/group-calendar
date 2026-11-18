<role>
You are a mobile/web UI motion designer and front-end engineer. Port the motion system below to my app. It was measured frame by frame from a screen recording of a One UI calendar app. Take only the motion rules and timings — do not copy any specific app's design, layout, or screens.
</role>

<inputs>
Ask me first:
1. Platform and tech stack (e.g. React Native/Expo, Flutter, SwiftUI, Jetpack Compose, React web, Vue).
2. Which screens and interactions should get motion (popups, tab switches, lists, input fields, save, delete confirmation, page navigation, etc.).
3. Whether animation code already exists, and where.
</inputs>

<principles>
1. Morph, don't spawn. An existing shape grows or shrinks instead of a new element appearing: the input pill becomes a card, the bottom toolbar becomes the confirmation dialog. The same container changes size, corner radius and color; only its content is swapped.
2. Open slow, close fast. Closing is 20–60% shorter than opening.
3. Container first, content after. Content fades in once the container's move is 50–60% done.
4. No bounce. Use decelerating curves only: fast start, soft stop. If you use springs, keep overshoot near zero.
5. Small state changes fade; only big moves slide. A selection indicator never glides between items — it disappears and reappears.
6. Put the input away before showing the result. On save, the input collapses first, then the new item appears.
7. Anything attached to the keyboard rides on top of it. It must never lag behind or be covered.
</principles>

<tokens>
Easing:
- EASE_OUT (enter, settle): cubic-bezier(0.2, 0, 0, 1)
- EASE_IN (exit): cubic-bezier(0.3, 0, 1, 1)
- Long-tail settle (pages): cubic-bezier(0.05, 0.7, 0.1, 1)

Durations (ms):
- swap 120: selection indicator, icon swap, small state changes
- open 220 / close 180: popups, dialogs
- keyboard 280: following the keyboard (on iOS, use the duration from the keyboard event)
- page push 480 / pop 200: screen navigation
- page swipe ~500: first 120 linear + last 380 long tail
- collapse 90: card snapping back to a pill

Accessibility: when the OS "reduce motion" setting is on, skip every animation and jump straight to the final state.
</tokens>

<patterns>
Measurements come from the original recording (59.5fps). Map each pattern to the screen in my app that plays the same role.

A. Moving a selection (date, tab item, list row)
- The old indicator disappears in ~50ms; the new one fades in over 120ms. No position animation.
- Text tied to the selection (e.g. "Add on Nov 12") changes instantly, with no animation.

B. Center popup open/close
- Open, 220ms EASE_OUT: the card appears at the center, opacity 0→1, scale 0.95→1. At the same time the screen behind is covered by a light wash (light mode: white ~78%; dark mode: black ~60%).
- Close, 180ms EASE_IN: the same in reverse, faster. Back gestures and scrim taps also play the animation before actually closing.
- Do not zoom out of the tapped element. The goal is quiet.

C. Paging (months, weeks, cards)
- The page follows the finger. On release, the first part of the remaining distance is fast (keep momentum, no ease-in); the last ~300ms creeps in by a few pixels on a long tail.
- When the new page covers more than half the screen, swap the title and related text in one go.
- The selection jumps automatically to the first item of the new page (e.g. the 1st of the month).

D. Bottom input pill → card above the keyboard (key pattern)
- On tap: the placeholder swaps instantly to an example sentence.
- Over 200ms EASE_OUT the pill grows upward into a card, anchored at its bottom edge: height +~44px (one chip row), ~8px wider on each side, corner radius 26 → 24.
- The chip row inside the card fades in only after the card is 60%+ grown.
  - Empty field: suggestion chips that append text when tapped.
  - While typing: "understood" chips (date, time, category, people, etc.).
- The + button turns into a check with a 90° rotation: gray check on a gray circle while the input is invalid; white check on an accent circle once it is valid.
- When the keyboard rises, the card rises with it, 8px above the keyboard (keyboard 280ms; on iOS, the keyboard's duration).
- When the keyboard goes down: the card snaps back to a pill in 90ms while still up, then rides down with the keyboard and returns to its original width. The check turns back into +.
- Keep the chip row inside the card or absolutely positioned so typing never pushes the layout. The screen behind must not jump.

E. Save order
- On submit, collapse the input card and dismiss the keyboard first.
- Only when both the save request and the keyboard descent (280ms) are done, clear the input and show the new item in the list/calendar.
- On failure, keep the input text and show the error.

F. Screen navigation (push/pop)
- Push, 480ms: the tapped card darkens immediately as press feedback. The new screen slides in from the right; the old screen moves left at ~1/3 the speed and darkens. The new screen's content appears mid-transition (~300ms in).
- Pop, 200ms: the same path in reverse, much faster. The returning screen already reflects any change (e.g. a deletion).

G. Toolbar → confirmation dialog
- The floating bottom toolbar container itself grows upward into the dialog (~200ms EASE_OUT, the top edge slowing as it rises).
- Toolbar icons fade out while the dialog text fades in, overlapping for ~60ms.
- The background dims more slowly, finishing over ~400ms.
- Dismissing shrinks it back into the toolbar in 120ms.

H. Pull up to reveal a list (split view)
- Dragging up shrinks the grid rows with the finger. Item labels fade first (~80ms), then event bars thin down to colored lines.
- Then the list panel slides up from the bottom (~170ms).
- Reversing: the list goes down first, the rows grow back, and the labels return last.

I. Sync/loading indicator
- A small dot appears, splits into four dots that orbit, then merges back into one. The surrounding layout does not move.
</patterns>

<platform_notes>
- Web: use CSS transitions/animations or the Web Animations API. Animate only transform and opacity; handle height changes with transforms or the grid-template-rows trick where possible. On mobile web, compute keyboard height from window.visualViewport resize events and lift the card accordingly.
- React Native: use Animated or Reanimated. transform/opacity on the native driver; layout values (height, width, color) on the JS driver — never mix the two on the same view. Android draws edge-to-edge, so the window does not shrink for the keyboard: lift the element yourself by the overlap computed from keyboardDidShow's endCoordinates.screenY and measureInWindow. On iOS, use keyboardWillShow's duration.
- Flutter / SwiftUI / Compose: translate the bezier values into each platform's Curve/Easing, and keep the duration tokens as constants in one file.
</platform_notes>

<banned>
- Bouncy easing, large overshoot
- Popups zooming out of the tapped element (violates B)
- Selection indicators gliding between items (violates A)
- Opening and closing at the same speed
- Content appearing at the same moment as its container (container first, content after)
- The screen behind shifting or jumping while typing
- Decorative effects: particles, glows, flashy gradients
</banned>

<build>
1. Put duration and easing tokens in one place (a motion module) and make every animation use only those tokens.
2. First build a helper that reads the reduce-motion setting, and route every animation call through it.
3. Before writing code, show me a table mapping my screens to patterns A–I, and wait for my OK.
4. Implement one pattern per step (or per commit) so each can be checked on its own.
5. Do not change existing layout or data flow — only add or replace motion.
</build>

<verify>
- If possible, screen-record and time each pattern frame by frame (at 60fps, 1 frame ≈ 16.7ms). Each should be within ±30ms of the measured value.
- Always check the keyboard pattern (D) on a real device. Simulators and desktop browsers have no on-screen keyboard, so they can't verify it.
- With reduce motion on, every screen must work correctly with no animation.
- Check the scrim and shadows in both light and dark mode.
</verify>

<start>
Ask me the inputs above, show the mapping table of my screens to patterns A–I, and write code only after I confirm.
</start>
