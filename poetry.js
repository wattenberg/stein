
function main() {
  let ANIMATED = 0, STILL = 1, ORIGINAL = 2;
  let state = {
      style: ANIMATED,
      paraNum: 1
  };
  let text = document.getElementById('text').innerHTML;
  let paras = text.split('\n').filter(p => p.length);
  let hasScrolledOnce = false;

  function updateParamDisplays(noHashUpdate) {
    if (!noHashUpdate) {
      window.location.hash =
         '#para=' + state.paraNum + '&style=' + state.style;
    }
    document.getElementById('details').innerHTML = 
      '¶ ' + state.paraNum;
    document.getElementById('style-menu').value = state.style;
    document.getElementById('previous').disabled = state.paraNum <= 1;
    document.getElementById('next').disabled = state.paraNum >= paras.length;
  }

  function setStateFromHash() {
    let hash = window.location.hash;
    if (hash.length > 1) {
      let params = {};
      hash.slice(1).split('&').forEach(s => {
        let p = s.split('=');
        params[p[0]] = p[1];
      });
      state.paraNum = Number(params['para']) || state.paraNum;
      state.style = params['style'] || state.style;

      // Make sure the text part is in view if we've never scrolled
      // down before. Don't keep doing this, though, because
      // it can get annoying.
      if (!hasScrolledOnce) {
        hasScrolledOnce = true;
        document.getElementById('details').scrollIntoView(
          {behavior: "smooth", block: "center", inline: "nearest"});
      }
      //document.getElementById('details').scrollIntoView(true);
    }
    setParaNum(state.paraNum, true);
  }
  
  function setParaNum(n, noHashUpdate) {
    state.paraNum = Math.max(1, Math.min(paras.length, n));
    let para = paras[n - 1];
    updateParamDisplays(noHashUpdate);
    animationID = Date.now();
    createAnimation(para, animationID);
  }

  // Handle events from the reader.
  document.getElementById('random').onclick = () => {
    setParaNum(Math.round(1 + paras.length * Math.random()));
  };
  document.getElementById('next').onclick = () => {
    setParaNum(state.paraNum + 1);
  };
  document.getElementById('previous').onclick = () => {
    setParaNum(state.paraNum - 1);
  };
  document.getElementById('style-menu').onchange = (e) => {
    let newStyle = state.style;
    if (document.getElementById('animated').selected) {
      newStyle = ANIMATED;
    }
    if (document.getElementById('still').selected) {
      newStyle = STILL;
    }
    if (document.getElementById('original').selected) {
      newStyle = ORIGINAL;
    }
    if (newStyle != state.style) {
      state.style = newStyle;
      setParaNum(state.paraNum);
    }
  };

  // Kick things off!
  setStateFromHash();  
  window.addEventListener('hashchange', setStateFromHash);


  // Do the poem-like formatting.
  function formatAsPoem(text) {
    function before(s, i, pattern) {
      let n = pattern.length;
      return pattern == s.substring(i - n, i);
    }
    function after(s, i, pattern) {
      let n = pattern.length;
      return pattern == s.substring(i + 1, i + n + 1);
    }
    function splitWithRule(s, rule) {
      let results = [];
      let last = 0;
      for (let i = 0; i < s.length; i++) {
        if (rule(s, i, last)) {
          results.push(s.substring(last, i + 1));
          last = i + 1;
        }
      }
      results.push(s.substring(last, s.length));
      return results;
    }

    // Split into sentences.
    function sentenceRule(s, i) {
      if (s.charAt(i) == '"' && s.charAt(i - 1) == '.') {
        return true;
      }
      if (s.charAt(i) == '.') {
        if (after(s, i, '"')) {
          return false;
        }
        return !before(s, i, 'Mr') && !before(s, i, 'Mrs') ;
      }
    }
    let sentences = splitWithRule(text, sentenceRule);

    // Split each line based on punctuation.
    function punctuationRule(s, i) {
      let c = s.charAt(i);
      return c == ',' || c == ';'
    }
    let pieces = [];
    sentences.forEach(sentence => {
      let chunks = splitWithRule(sentence, punctuationRule);
      pieces = pieces.concat(chunks);
      pieces.push(''); // causes line break.
    });

    // Split each piece between punctuation into lines.
    function lineRule(s, i, last) {
      // Avoid hanging tiny bits of text.
      if (i - last < 15 || s.length - i < 15) {
        return false;
      }
      // Only break on words
      if (s.charAt(i) != ' ') {
        return false;
      }

      // Break before certain phrases
      if (after(s, i, 'and ') && !after(s, i, 'and women')) {
        return true;
      }
      if (after(s, i, 'but ')) {
        return true;
      }
      if (after(s, i, 'to be ')) {
        return true;
      }
      // Break after a bunch of other words.
      return before(s, i, ' in them') ||
          before(s, i, ' saying') || 
          before(s, i, ' before') || 
          before(s, i, ' after') ||
          before(s, i, ' where') ||
          before(s, i, ' about') ||
          before(s, i, ' that') ||
          before(s, i, ' when') ||
          before(s, i, ' with') ||
          before(s, i, ' who') ||
          before(s, i, ' was') && !before(s, i, 'here was') ||
          before(s, i, ' of') ||
          before(s, i, ' or') ||
          before(s, i, ' as') && !after(s, i, 'I');
    }

    let words = [];
    pieces.forEach(piece => {
       words = words.concat(splitWithRule(piece, lineRule));
    });
    return words;
  }


  // Define functions and data for automatic formatting of the
  // text. We need to specify which words are
  // "boring," and which words make natural text boundaries.

  let boringWords = `
    or some so up and then had have has one but each out by that this of in 
    it a very at kind an the with for is are been was were am to be can as
    `;
  let boringTable = {};
  boringWords.split(/\s+/).forEach(w => boringTable[w] = 1);
  function standardize(w) {
    return w.toLowerCase().replace(/[^a-z]/, '');
  }
  function same(w1, w2) {
    return standardize(w1) == standardize(w2);
  }
  function isBoringWord(w) {
    return !w || boringTable[standardize(w)];
  }
  function isBoringToken(token) {
    return token.isFormatting || isBoringWord(token.word);
  }


  function* animateText(para, id) {
    // Create initial HTML of text, which we will then style
    // during the animation.
    let book = d3.select('#book');
    let pieces = state.style == ORIGINAL ? [para] :
                 formatAsPoem(para);

    // Translate words into tokens. Add HTML line breaks.
    let words = [];
    pieces.forEach(p => {
      words = words.concat(p.split(' ').filter(x => x));
      words.push('<br>');
    });
    let tokens = words.map(w => {
      return {word: w, 
              isFormatting: w == '<br>', 
              highlight: 0, 
              current: 0};
    });

    // Write the tokens on screen.
    book.html('');
    book.selectAll('.tokens')
      .data(tokens)
      .enter()
      .append('span')
      .style('border-style', 'solid')
      .style('border-width', '0px')
      .style('border-bottom-width', '4px')
      .style('border-color', '#fff')
      .html(d => d.word + ' ');

    // Pad with blank lines at bottom; otherwise we can get weird
    // jumpy scrolling behavior moving between paragraphs.
    for (let i = 0; i < 20 - pieces.length; i++) {
      let br = document.createElement('BR');
      document.getElementById('book').appendChild(br);
    }

    // Pause for breath, show text.
    // If the style doesn't show animation, then this is effectively
    // the end of the routine because the generator won't be called again.
    yield 0;

    // Helper function for pattern matching; ignore format info
    // as related to any pattern, looking forward or backward
    // for matches.
    function match(i, j, dir) {
      do {
        i += dir;
        j += dir;
      } while (tokens[i] && tokens[j] && tokens[i].isFormatting);

      return tokens[i] && tokens[j] && 
             same(tokens[i].word, tokens[j].word);
    }

    // Make color for highlight, depending on intensity.
    function highlightColor(t) {
      t = Math.max(0, Math.min(t, 1));
      return 'hsla(203,40%,75%,' + t + ')';
    }

    // Perpetual animation!
    for (;;) {
      // Each step of this loop highlights a word in the poem,
      // and all previous words that match it (subject to some
      // restrictions about boring matches of boring words.)
      for (let i = 0; i < tokens.length; i++) {
        // Ignore format tokens.
        if (tokens[i].isFormatting) {
          continue;
        }
        // Any previous highlights should decay a little.
        tokens.forEach(t => {
          t.highlight = Math.max(0, t.highlight - .1);
          t.current = Math.max(0, t.current - .1);
        });
        // Mark current token as highlighted & current.
        tokens[i].highlight = 1;
        tokens[i].current = 1;

        // Mark matching tokens as highlighted, unless they
        // are boring. We don't want every "of" in the text
        // flashing all the time for no good reason.
        for (let j = 0; j < i; j++) {
          if (!tokens[j].isFormatting &&
               same(tokens[i].word, tokens[j].word) && 
                (!isBoringWord(tokens[j].word) ||
                 match(i, j, -1) ||
                 match(i, j, 1))) {
              tokens[j].highlight = 1;
          }
        }

        // Set a transition.
        book.selectAll('span').transition().duration(80)
          .style('background-color', 
                  d => highlightColor(.7 * d.highlight))
          .style('border-color', d => highlightColor(d.current));
        yield 80;
      }
      // Pause, let things settle, before starting again.
      tokens.forEach(t => {
        t.highlight = 0;
        t.current = 0;
      });
      book.selectAll('span').transition().duration(1000)
          .style('background-color', '#fff')
          .style('border-color', '#fff');
      yield 1200;
    }
  }

  // Handle animations. Don't call old one if it is obsolete.
  function createAnimation(para, id) {
    let generator = animateText(para);
    function showAnimation() {
      if (id != animationID) { // Means we are doing new animation.
        return;
      }
      let delay = generator.next().value;
      if (state.style != ANIMATED || delay === undefined) {
        return;
      }
      setTimeout(() => window.requestAnimationFrame(showAnimation),
       delay);
    }
    showAnimation();
  }
}

