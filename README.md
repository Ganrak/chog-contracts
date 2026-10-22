# Chog Contracts

**FUD posts become monsters. Your Chog NFT hunts them.**

A free browser game for [Chog Genesis](https://www.chog.xyz) holders on Monad, built for **Chogathon 2026** by [@Ganraktv](https://x.com/Ganraktv).

**Play:** https://chog-contracts.netlify.app

## What it is

Someone on X says "Monad is a ghost chain". In Chog Contracts that post becomes a monster contract: its words decide the monster's kind, level and weak spot. You send your Chog to hunt it, fight it turn by turn, and take the $CHOG bounty.

- **FUD Forge.** Paste any post right on the landing page and it becomes a monster built from its own words.
- **Your NFT is the character.** The Chog's real on-chain traits become its moves: laser eyes give you a laser. Every hunter card and every move button says which trait a move came from ("Rally ← MMGA Cap"). No two Chogs fight the same way.
- **It remembers.** Every hunt and expedition is written into the Chog's journal: wins, scars and injuries that need rest, trophies, levels and ten badges. The journal is stored per token on the server, so the story stays with the NFT when it changes hands.
- **A weekly boss and a real leaderboard.** Everyone hunts the same raid boss at level 10. Each hunt is replayed on the server from a signed seed and the keys pressed, so only real damage counts; your score is your best 3 hunts, and a "Latest hunts" feed shows who just hit it. A weekly $CHOG prize pool for the top 10 is built and opens once it is funded.
- **Rent your Chog out.** No time to play? List your Chog for hire with one plain-text signature. Other players hunt with it and you get 30% of every bounty (simulated in the demo).
- **Share a win.** After a hunt, make an image card or an 8-second MP4 victory clip right in the browser and post it on X.
- **No Chog?** The free Wannabe Chog takes training and quiet FUD (level 1-2); louder FUD and the boss need a real Chog, yours or a hired one. Whale mode (account menu) loads six test Chogs.
- **More to do:** Wannabe's Room (decorate, send your Chog on expeditions with hand-written stories and choices), an Arcade with Chog mini games, and a Brick Studio that turns your Chog into a buildable mosaic.

## Wallet safety

The site never asks for a transaction, an approval or a token permit. Ownership is proven in one of two ways:

1. **A plain-text signature** (`personal_sign`), free, read before signing.
2. **No wallet connection at all:** paste your address, send a small exact amount of MON **from your wallet to the same address**, and paste the transaction hash. The MON comes straight back to you; only gas is spent. The server checks the transfer on Monad.

The site never shows any address other than your own, and it never asks for a seed phrase.

No cookies, analytics or trackers: scripts, fonts and libraries are all served from the site itself, under a strict Content-Security-Policy. Privacy and terms are in the footer.

## Tech

- Static ES modules, no framework: `demo.html` + `src/*.js`. [three.js](https://threejs.org) for the 3D gate and room (`vendor/three`).
- Chog data read straight from Monad mainnet over JSON-RPC (`src/chain.js`), art from IPFS.
- Netlify Functions + Netlify Blobs for the leaderboard (`netlify/functions`):
  - `boss-start` hands out a seed in an HMAC-signed ticket,
  - `boss-finish` replays the hunt with `src/replay.js` (the same combat code the browser runs) and records only the replayed damage,
  - `self-verify` checks the send-to-yourself login (smart accounts too, through a call trace),
  - `chog` keeps each Chog's story by token id (only the current holder can write it),
  - `profile` stores hunter names, `leaderboard` serves the week and the latest hunts,
  - `boss-finish` and `self-verify` are rate limited per visitor.
- [viem](https://viem.sh) to verify signatures; [mp4-muxer](https://github.com/Vanilagy/mp4-muxer) + WebCodecs for the victory clips (`vendor/mp4-muxer`).

## Run it locally

```powershell
./serve.ps1          # static server on http://localhost:8796/demo.html
./scripts/build.ps1  # writes the deployable site to ./site
```

The leaderboard functions need Netlify (`netlify dev`) and a `SCORE_SECRET` environment variable.

## Credits

- Chog art and traits: Chog Genesis on Monad.
- Monsters, the Wannabe Chog, its room and items, the map, the arenas and the arcade art: made with AI image tools and cut by hand.
- Potion bottles: a Sketchfab model.
- Built with help from Claude (Anthropic).
