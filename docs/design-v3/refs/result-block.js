/* =====================================================================
   TubeMine v3 - Analysis Result Block (shared renderers)
   window.TubeMineRB.renderResult(mountEl, tier, data, opts)
   window.TubeMineRB.renderEmpty(mountEl, data)
   window.TubeMineRB.renderLoading(mountEl)
   tier: 'anon' | 'free' | 'pro'
   data: optional, falls back to DEFAULT_DATA (the PixelForge demo).
   ===================================================================== */
(function () {
  /* ================= Default mock data ================= */
  const DEFAULT_DATA = {
    video: {
      title: "How I Actually Edit My YouTube Videos in 2026, My Complete Start-to-Finish Editing Workflow, Gear, Plugins & Color-Grading Setup (Full Uncut Walkthrough)",
      channel: "@PixelForge",
      total: "19,422",
    },
    sentiment: { pos: 68, neu: 24, neg: 8, posN: "13,207", neuN: "4,661", negN: "1,554", label: "Mostly positive", coverage: 92 },
    uniqueWords: "1,284",
    words: [
      ["tutorial",847],["love",662],["workflow",543],["helpful",449],["thanks",398],
      ["editing",364],["camera",307],["amazing",261],["premiere",233],["tips",210],
      ["sound",188],["color",165],["beginner",142],["underrated",121],["subscribed",109],
      ["timeline",98],["transitions",91],["lighting",84],["audio",77],["preset",70],
      ["mic",63],["pacing",58],["broll",54],["thumbnail",49],["hook",45],
      ["retention",41],["script",37],["render",33],["colorgradingworkflow",29],["plugin",25],
    ],
    uniqueEmoji: 142,
    emoji: [
      ["🔥","18.2%"],["❤️","14.7%"],["👏","11.3%"],["💯","9.6%"],["😍","8.4%"],
      ["🙏","7.2%"],["👍","6.8%"],["😂","5.9%"],["⚡","4.5%"],["💪","3.1%"],
      ["✨","2.7%"],["🚀","2.3%"],["👀","2.0%"],["👌","1.7%"],["⭐","1.4%"],
    ],
    comments: [
      { a:"@sarah_makes", s:"pos", likes:"1,240", replies:"38", when:"2d ago",
        text:"This is the workflow video I've needed for months. The premiere shortcut at 4:12 alone is worth a sub. Thank you so much, instantly subscribed." },
      { a:"@mike.travels", s:"neu", likes:"312", replies:"5", when:"3d ago",
        text:"Quick question, what mic are you using for the voiceover? It sounds amazing and I have been hunting for an upgrade." },
      { a:"@designdaily", s:"pos", likes:"209", replies:"12", when:"4d ago",
        text:"Love the part about cutting B-roll first. I always do it last and it slows me down so much. Trying this tomorrow." },
      { a:"@noahcodes", s:"neu", likes:"88", replies:"3", when:"5d ago",
        text:"Sponsored sections in the middle were kind of jarring honestly, but the actual tutorial parts were genuinely great and clear." },
      { a:"@priya.films", s:"neg", likes:"41", replies:"9", when:"5d ago",
        text:"Way too long. This could have been a 6 minute video honestly, half of it is filler and repeated points." },
      { a:"@longwinded_larry_the_editor_who_writes_full_essays", s:"neu", likes:"17", replies:"0", when:"1w ago",
        text:"Okay so I have been editing for about three years now and I picked up at least four things from this that I had never seen before, especially the bit about color matching across clips shot on different cameras, which has always been a nightmare for me, and the section on audio ducking under the voiceover, and honestly the pacing advice in the second half, and also the keyboard shortcut chapter, so thank you for putting this together, it is clearly a lot of work." },
    ],
  };

  /* ================= Icons ================= */
  const IC = {
    download: '<svg class="icon ic-14" viewBox="0 0 24 24"><path d="M12 4v10"/><path d="m7.5 10.5 4.5 4 4.5-4"/><path d="M5 19h14"/></svg>',
    lock: '<svg class="icon ic-13" viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
    signin: '<svg class="icon ic-13" viewBox="0 0 24 24"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="M10 17l5-5-5-5"/><path d="M15 12H3"/></svg>',
    chevron: '<svg class="icon ic-13" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg>',
    inbox: '<svg class="icon ic-16" viewBox="0 0 24 24" style="width:18px;height:18px"><path d="M4 13h4l1.5 3h5L16 13h4"/><path d="M5 13 7 5h10l2 8v5a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z"/></svg>',
  };

  /* ================= Helpers ================= */
  const num = (s) => parseInt(String(s).replace(/[^\d]/g, ''), 10) || 0;
  const fmt = (n) => n.toLocaleString('en-US');

  function exportsHTML(tier, signInHref) {
    if (tier === 'pro') {
      return `<button class="btn btn--primary">${IC.download} Save CSV</button>
              <button class="btn btn--outline">Save JSON</button>
              <button class="btn btn--outline">Save Excel</button>`;
    }
    if (tier === 'anon') {
      return `<a class="btn btn--primary" href="${signInHref}">${IC.download} Save CSV</a>`;
    }
    return `<button class="btn btn--primary">${IC.download} Save CSV</button>`;
  }

  function headHTML(tier, data, signInHref) {
    return `<div class="rb-head">
      <div class="rb-head-l">
        <div class="rb-head-title"><b>${data.video.total}</b> comments analyzed</div>
        <div class="rb-head-video" title="${data.video.title}">${data.video.title} <span class="by">· ${data.video.channel}</span></div>
      </div>
      <div class="rb-exports">${exportsHTML(tier, signInHref)}</div>
    </div>`;
  }

  /* ---- Sentiment ---- */
  function sentimentWidget(tier, data, opts) {
    const s = data.sentiment;
    const ru = opts.ruHeavy ? `<span class="ru-pill"><span>β</span> RU experimental</span>` : '';
    const head = `<div class="widget-head">
        <div class="widget-head-l">
          <div class="widget-title">Sentiment ${ru}</div>
          <div class="widget-sub">across ${data.video.total} comments</div>
        </div>
      </div>`;

    if (tier === 'anon') {
      return `<div class="widget">${head}
        <div class="s-locked">
          <span class="lock-badge">${IC.lock}</span>
          <div>Sign in to see the sentiment<br>breakdown for this video.</div>
          <div><a href="${opts.signInHref}">Sign in</a></div>
        </div>
      </div>`;
    }

    const barFree = `<div class="s-bar h14">
        <span class="pos" style="width:${s.pos}%"></span>
        <span class="neu" style="width:${s.neu}%"></span>
        <span class="neg" style="width:${s.neg}%"></span>
      </div>`;
    /* Only paint an inline % when the segment is wide enough to hold the
       text; otherwise the legend below carries the exact number. */
    const seg = (cls, pct) => `<span class="${cls}" style="width:${pct}%">${pct >= 12 ? '<i>'+pct+'%</i>' : ''}</span>`;
    const barPro = `<div class="s-bar h22">
        ${seg('pos', s.pos)}
        ${seg('neu', s.neu)}
        ${seg('neg', s.neg)}
      </div>`;

    if (tier === 'free') {
      return `<div class="widget">${head}
        <div class="widget-body">
          ${barFree}
          <div class="s-label"><span class="dot"></span> ${s.label}</div>
        </div>
        <div class="tier-cta">${IC.lock}<span><a href="${opts.upgradeHref}">Upgrade</a> for exact counts &amp; per-segment %</span></div>
      </div>`;
    }

    /* pro */
    return `<div class="widget">${head}
      <div class="widget-body">
        ${barPro}
        <div class="s-legend">
          <div class="row"><span class="ld pos"></span><span class="lname">Positive</span><span class="lval">${s.posN}</span></div>
          <div class="row"><span class="ld neu"></span><span class="lname">Neutral</span><span class="lval">${s.neuN}</span></div>
          <div class="row"><span class="ld neg"></span><span class="lname">Negative</span><span class="lval">${s.negN}</span></div>
        </div>
        <div class="s-label"><span class="dot"></span> ${s.label}</div>
      </div>
      <div class="s-foot widget-foot">Based on ${s.coverage}% of analyzed comments</div>
    </div>`;
  }

  /* ---- Top words ---- */
  function wordRows(words) {
    const max = words[0][1];
    return words.map(([w,c]) => `<div class="tw-row">
        <div class="tw-bar"><span class="tw-fill" style="width:${Math.max(8,(c/max*100)).toFixed(1)}%"></span><span class="tw-word">${w}</span></div>
        <div class="tw-count">${c}</div>
      </div>`).join('');
  }
  function topWordsWidget(tier, data, opts) {
    const counts = { anon:5, free:15, pro:18 };
    const shown = counts[tier];
    const totalUnique = num(data.uniqueWords);
    const head = `<div class="widget-head">
        <div class="widget-head-l">
          <div class="widget-title">Top words</div>
          <div class="widget-sub">across ${data.video.total} comments</div>
        </div>
        <div class="widget-meta">${data.uniqueWords} unique<br>top ${shown} shown</div>
      </div>`;

    if (tier === 'anon') {
      return `<div class="widget">${head}
        <div class="widget-body"><div class="tw-grid">${wordRows(data.words.slice(0,5))}</div></div>
        <div class="tier-cta">${IC.signin}<span><a href="${opts.signInHref}">Sign in</a> for ${fmt(totalUnique-5)} more words</span></div>
      </div>`;
    }
    if (tier === 'free') {
      return `<div class="widget">${head}
        <div class="widget-body"><div class="tw-grid">${wordRows(data.words.slice(0,15))}</div></div>
        <div class="tier-cta">${IC.lock}<span><a href="${opts.upgradeHref}">Upgrade</a> for ${fmt(totalUnique-15)} more words</span></div>
      </div>`;
    }
    /* pro, collapsible */
    return `<div class="widget" data-tw-pro>
      ${head}
      <div class="widget-body"><div class="tw-grid" data-tw-list>${wordRows(data.words.slice(0,18))}</div></div>
      <div class="tier-cta btnlike widget-foot" data-tw-toggle>${IC.chevron}<span data-tw-label>Show all (${data.uniqueWords})</span></div>
    </div>`;
  }

  /* ---- Emoji ---- */
  function emojiRows(list) {
    const max = parseFloat(list[0][1]);
    return list.map(([g,p]) => `<div class="em-row">
        <span class="glyph">${g}</span>
        <span class="em-bar"><span style="width:${(parseFloat(p)/max*100).toFixed(0)}%"></span></span>
        <span class="em-pct">${p}</span>
      </div>`).join('');
  }
  function emojiWidget(tier, data, opts) {
    const counts = { anon:5, free:15, pro:15 };
    const shown = counts[tier];
    const totalUnique = data.uniqueEmoji;
    const head = `<div class="widget-head">
        <div class="widget-head-l">
          <div class="widget-title">Emoji</div>
          <div class="widget-sub">${data.emojiComments || '6,142'} comments with emoji</div>
        </div>
        <div class="widget-meta">${totalUnique} unique<br>top ${shown} shown</div>
      </div>`;

    if (tier === 'anon') {
      return `<div class="widget">${head}
        <div class="widget-body"><div class="em-grid">${emojiRows(data.emoji.slice(0,5))}</div></div>
        <div class="tier-cta">${IC.signin}<span><a href="${opts.signInHref}">Sign in</a> for ${totalUnique-5} more</span></div>
      </div>`;
    }
    if (tier === 'free') {
      return `<div class="widget">${head}
        <div class="widget-body"><div class="em-grid">${emojiRows(data.emoji.slice(0,15))}</div></div>
        <div class="tier-cta">${IC.lock}<span><a href="${opts.upgradeHref}">Upgrade</a> for ${totalUnique-15} more</span></div>
      </div>`;
    }
    return `<div class="widget">${head}
      <div class="widget-body"><div class="em-grid">${emojiRows(data.emoji)}</div></div>
    </div>`;
  }

  /* ---- Comments table ---- */
  function commentsTable(data) {
    const rows = data.comments.map(c => `<tr>
        <td class="col-author"><div class="c-author" title="${c.a}">${c.a}</div></td>
        <td class="col-comment"><div class="c-text">${c.text}</div></td>
        <td class="col-sent"><span class="c-sent ${c.s}"><span class="dot"></span>${c.s==='pos'?'Positive':c.s==='neg'?'Negative':'Neutral'}</span></td>
        <td class="col-likes"><div class="c-num">${c.likes}</div><span class="m-label">likes</span></td>
        <td class="col-replies"><div class="c-num ${c.replies==='0'?'zero':''}">${c.replies==='0'?'·':c.replies}</div><span class="m-label">replies</span></td>
        <td class="col-when"><div class="c-when">${c.when}</div></td>
      </tr>`).join('');
    return `<div class="ctable-card"><div class="ctable-scroll">
      <table class="ctable">
        <colgroup>
          <col style="width:168px"><col><col style="width:116px">
          <col style="width:76px"><col style="width:76px"><col style="width:84px">
        </colgroup>
        <thead><tr>
          <th>Author</th><th>Comment</th><th>Sentiment</th>
          <th class="num">Likes</th><th class="num">Replies</th><th>When</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div></div>`;
  }

  /* ---- Empty ---- */
  function commentsEmpty() {
    return `<div class="ctable-card"><div class="ctable-empty">
      <span class="badge">${IC.inbox}</span>
      <div class="title">No comments to analyze</div>
      <div class="sub">This video has its comments turned off, or none have been posted yet.</div>
    </div></div>`;
  }

  /* ================= Public renderers ================= */
  function renderResult(mount, tier, data, opts) {
    if (!mount) return;
    data = data || DEFAULT_DATA;
    opts = Object.assign({
      ruHeavy: false,
      signInHref: 'TubeMine Login.html?intent=signup',
      upgradeHref: 'TubeMine Pricing.html',
    }, opts || {});

    mount.classList.add('result-block');
    mount.innerHTML =
      headHTML(tier, data, opts.signInHref) +
      `<div class="rb-widgets">
         ${sentimentWidget(tier, data, opts)}
         ${topWordsWidget(tier, data, opts)}
         ${emojiWidget(tier, data, opts)}
       </div>` +
      commentsTable(data);

    // pro top-words toggle
    const toggle = mount.querySelector('[data-tw-toggle]');
    if (toggle) {
      let expanded = false;
      toggle.addEventListener('click', () => {
        expanded = !expanded;
        const list = mount.querySelector('[data-tw-list]');
        const label = mount.querySelector('[data-tw-label]');
        list.innerHTML = wordRows(expanded ? data.words : data.words.slice(0,18));
        label.textContent = expanded ? 'Hide' : `Show all (${data.uniqueWords})`;
        toggle.querySelector('svg').style.transform = expanded ? 'rotate(180deg)' : '';
      });
    }
  }

  function renderEmpty(mount, data) {
    if (!mount) return;
    data = data || DEFAULT_DATA;
    mount.classList.add('result-block');
    mount.innerHTML =
      `<div class="rb-head">
        <div class="rb-head-l">
          <div class="rb-head-title"><b>0</b> comments analyzed</div>
          <div class="rb-head-video" title="${data.video.title}">${data.video.title} <span class="by">· ${data.video.channel}</span></div>
        </div>
        <div class="rb-exports"><button class="btn btn--primary" disabled style="opacity:.5;cursor:not-allowed">${IC.download} Save CSV</button></div>
      </div>` +
      commentsEmpty();
  }

  function renderLoading(mount) {
    if (!mount) return;
    mount.classList.add('result-block');
    const skRows = (n) => Array.from({length:n}).map(()=>`<div class="skw-rows"><span class="skel sk-line" style="width:${60+Math.random()*35}%"></span></div>`).join('');
    const emCells = Array.from({length:8}).map(()=>`<span class="skel sk-emrow"></span>`).join('');
    const wRows = (n)=>`<div class="tw-grid">${Array.from({length:n}).map(()=>`<span class="skel" style="height:26px;border-radius:6px"></span>`).join('')}</div>`;
    const ctRow = ()=>`<div class="sk-ctrow">
        <span class="skel sk-line" style="width:80%"></span>
        <span class="skel sk-line" style="width:95%"></span>
        <span class="skel sk-line" style="width:70%"></span>
        <span class="skel sk-line" style="width:60%;justify-self:end"></span>
        <span class="skel sk-line" style="width:50%;justify-self:end"></span>
        <span class="skel sk-line" style="width:80%"></span>
      </div>`;

    mount.innerHTML =
      `<div class="skw-head">
         <div style="display:grid;gap:8px;flex:1;max-width:360px">
           <span class="skel sk-line" style="height:16px;width:55%"></span>
           <span class="skel sk-line" style="height:11px;width:80%"></span>
         </div>
         <span class="skel" style="width:104px;height:34px;border-radius:9999px"></span>
       </div>
       <div class="rb-widgets">
         <div class="widget">
           <div class="widget-head"><div style="display:grid;gap:6px;flex:1"><span class="skel sk-line" style="width:50%"></span><span class="skel sk-line" style="height:10px;width:70%"></span></div></div>
           <span class="skel sk-line" style="height:14px;border-radius:9999px"></span>
           ${skRows(3)}
         </div>
         <div class="widget">
           <div class="widget-head"><div style="display:grid;gap:6px;flex:1"><span class="skel sk-line" style="width:45%"></span><span class="skel sk-line" style="height:10px;width:70%"></span></div></div>
           ${wRows(8)}
         </div>
         <div class="widget">
           <div class="widget-head"><div style="display:grid;gap:6px;flex:1"><span class="skel sk-line" style="width:40%"></span><span class="skel sk-line" style="height:10px;width:65%"></span></div></div>
           <div class="sk-emgrid">${emCells}</div>
         </div>
       </div>
       <div class="sk-ctable">
         <div class="sk-ctrow sk-cthead">
           <span class="skel sk-line" style="width:50%;opacity:.6"></span>
           <span class="skel sk-line" style="width:40%;opacity:.6"></span>
           <span class="skel sk-line" style="width:60%;opacity:.6"></span>
           <span class="skel sk-line" style="width:50%;justify-self:end;opacity:.6"></span>
           <span class="skel sk-line" style="width:60%;justify-self:end;opacity:.6"></span>
           <span class="skel sk-line" style="width:50%;opacity:.6"></span>
         </div>
         ${ctRow()}${ctRow()}${ctRow()}${ctRow()}
       </div>`;
  }

  /* ================= Single-widget showcase (marketing / feature blocks) =================
     Renders ONE widget card in the real product style, no gating CTAs. */
  function showcaseSentiment(data, ru) {
    const s = data.sentiment;
    const pill = ru ? '<span class="ru-pill"><span>β</span> RU experimental</span>' : '';
    const seg = (cls, pct) => `<span class="${cls}" style="width:${pct}%">${pct >= 12 ? '<i>'+pct+'%</i>' : ''}</span>`;
    return `<div class="widget">
      <div class="widget-head"><div class="widget-head-l">
        <div class="widget-title">Sentiment ${pill}</div>
        <div class="widget-sub">across ${data.video.total} comments</div>
      </div></div>
      <div class="widget-body">
        <div class="s-bar h22">${seg('pos', s.pos)}${seg('neu', s.neu)}${seg('neg', s.neg)}</div>
        <div class="s-legend">
          <div class="row"><span class="ld pos"></span><span class="lname">Positive</span><span class="lval">${s.posN}</span></div>
          <div class="row"><span class="ld neu"></span><span class="lname">Neutral</span><span class="lval">${s.neuN}</span></div>
          <div class="row"><span class="ld neg"></span><span class="lname">Negative</span><span class="lval">${s.negN}</span></div>
        </div>
        <div class="s-label"><span class="dot"></span> ${s.label}</div>
      </div>
    </div>`;
  }
  function showcaseWords(data, n) {
    return `<div class="widget">
      <div class="widget-head">
        <div class="widget-head-l"><div class="widget-title">Top words</div><div class="widget-sub">across ${data.video.total} comments</div></div>
        <div class="widget-meta">${data.uniqueWords} unique<br>top ${n} shown</div>
      </div>
      <div class="widget-body"><div class="tw-grid">${wordRows(data.words.slice(0, n))}</div></div>
    </div>`;
  }
  function showcaseEmoji(data, n) {
    return `<div class="widget">
      <div class="widget-head">
        <div class="widget-head-l"><div class="widget-title">Emoji</div><div class="widget-sub">${data.emojiComments || '6,142'} comments with emoji</div></div>
        <div class="widget-meta">${data.uniqueEmoji} unique<br>top ${n} shown</div>
      </div>
      <div class="widget-body"><div class="em-grid">${emojiRows(data.emoji.slice(0, n))}</div></div>
    </div>`;
  }
  function renderWidget(mount, kind, data, opts) {
    if (!mount) return;
    data = data || DEFAULT_DATA;
    opts = opts || {};
    mount.classList.add('result-block');
    let inner = '';
    if (kind === 'sentiment') inner = showcaseSentiment(data, !!opts.ru);
    else if (kind === 'words') inner = showcaseWords(data, opts.count || 10);
    else if (kind === 'emoji') inner = showcaseEmoji(data, opts.count || 10);
    mount.innerHTML = '<div class="rb-widgets" style="display:block">' + inner + '</div>';
  }

  window.TubeMineRB = { renderResult, renderEmpty, renderLoading, renderWidget, DEFAULT_DATA, IC };
})();
