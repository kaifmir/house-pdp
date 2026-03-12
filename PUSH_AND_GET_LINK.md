# Baby steps: Push to GitHub + Get a link anyone can open

---

## PART 1: Push your code to GitHub

You have two options. **Option A is easier** (no typing tokens).

---

### Option A: Push using GitHub Desktop (easiest)

**Step 1.** Download GitHub Desktop (if you don’t have it)  
- Go to: https://desktop.github.com/  
- Download and install it.  
- Open it and sign in with your GitHub account (shashwatbb).

**Step 2.** Add your project  
- In GitHub Desktop: **File** → **Add Local Repository…**  
- Click **Choose…** and go to:  
  `Documents` → `Work` → `Cursor` → **Conversational Agent**  
- Click **Add Repository**.

**Step 3.** Push  
- You should see your branch **main** and that it’s “ahead of origin”.  
- Click the blue **Push origin** button at the top.  
- If it asks you to sign in, use your GitHub account.  
- When it says “Successfully pushed”, you’re done with Part 1.

---

### Option B: Push using Terminal (with a token)

**Step 1.** Create a token on GitHub  
- Open: https://github.com/settings/tokens  
- Click **Generate new token** → **Generate new token (classic)**.  
- Name: e.g. `push from Cursor`.  
- Under **Repository access**, choose **Only select repositories** and select **scout-bot**.  
- Under **Permissions**, tick **repo**.  
- Click **Generate token**.  
- **Copy the token** (starts with `ghp_` or `github_pat_`) and keep it somewhere safe. Don’t share it or paste it in chat.

**Step 2.** Open Terminal in Cursor  
- Top menu: **Terminal** → **New Terminal**  
- Or press **Ctrl + `** (backtick).

**Step 3.** Run these two commands (one at a time)

First command — **replace `YOUR_TOKEN` with the token you copied**, then paste the whole line and press Enter:

```
cd "/Users/shashwat/Documents/Work/Cursor/Conversational Agent" && git remote set-url origin https://shashwatbb:YOUR_TOKEN@github.com/shashwatbb/scout-bot.git
```

Second command (just push):

```
git push origin main
```

If both run without errors, Part 1 is done.

---

## PART 2: Get a link so anyone can open the chatbot

After your code is on GitHub (Part 1 done), you can host it for free with **GitHub Pages** so anyone can open it with a link.

**Step 1.** Open your repo on GitHub  
- Go to: https://github.com/shashwatbb/scout-bot  

**Step 2.** Turn on GitHub Pages  
- Click **Settings** (top menu of the repo).  
- In the left sidebar, click **Pages**.  
- Under **Source** / **Build and deployment**:  
  - **Source**: choose **Deploy from a branch**.  
  - **Branch**: choose **main** and **/ (root)**.  
- Click **Save**.

**Step 3.** Wait 1–2 minutes  
- GitHub will build and publish your site.

**Step 4.** Get your link  
- On the same **Pages** settings page, you’ll see something like:  
  **“Your site is live at https://shashwatbb.github.io/scout-bot/”**  
- That link is the one you can share. Anyone can open it to use your chatbot.

---

## Quick checklist

- [ ] Part 1: Pushed code (Option A or B).  
- [ ] Part 2: Turned on Pages, chose branch **main**, saved.  
- [ ] Got the link: `https://shashwatbb.github.io/scout-bot/` (or whatever GitHub shows).  
- [ ] Shared the link so anyone can open the chatbot.

If any step fails, copy the exact error message and we can fix it step by step.
