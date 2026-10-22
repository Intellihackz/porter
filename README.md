# porter

a tiny next.js app that reverse engineers php apps into javascript source. the landing page lives at `/` and the tool at `/port`, where you can drop a whole folder (up to 10 php files, `vendor` and `node_modules` are skipped), flip between files, edit the php and watch the js update live, then download everything as a zip with the same folder layout. it all runs in the browser with no api keys and no server calls.

it's rule based, so think of it as a solid first draft of your js source rather than a magic button. it handles variables and `let` declarations, string concat and `"$interpolation"`, arrays and associative arrays (which become objects), `foreach`, functions with type hints, classes (properties, constants, static methods, constructors), closures and arrow functions, try/catch, mixed html/php templates, superglobals (mapped to express style `req.*`), and around 70 common builtins like `count`, `implode`, `str_replace`, `array_map`, `json_encode` and `isset`. anything it can't safely translate (database calls, sessions, sprintf, dates, file io...) shows up under "things to check by hand".

```bash
npm install
npm run dev     # http://localhost:3000
npm test        # converter tests
```

the whole converter lives in `lib/porter.js` if you want to add more rules.

## brand

everything lives in `brand/`: `icon.png` (512, favicon / app icon), `apple-icon.png` (180), `x-avatar.png` (400x400), `x-header.png` (1500x500), `og-image.png` (1200x630 link preview) and `wordmark.png` (transparent, for dark backgrounds). they're rendered from `brand/source.html`, so tweak that and re-screenshot if you want changes. the site already uses the icon and og image, link previews use whichever domain the site is served from (useporter.lol, porter.pxxlspace.cv, a preview url...), set `SITE_URL` only if you want to force one domain.

launch videos are recorded from the real app with `brand/video/rec.cjs` (frame by frame with a scripted cursor, 1080p h.264). start the app with `npx next start -p 3123`, then run `node brand/video/rec.cjs brand/video landing` or `... folder`. the folder demo uses the sample app in `brand/video/legacy-shop`.
