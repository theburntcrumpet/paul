# Book build pipeline (KDP paperback PDF + Kindle EPUB)

Source: a single markdown manuscript (`body.md`) with no front-matter block.
- Chapters are `# ` headings, written as `# Chapter N – <date>` (en dash). The date becomes an italic subtitle.
- A `## ` heading becomes a centred italic section heading (e.g. "Three Years Later").
- `* * *` on its own line becomes a scene break.

Tools: pandoc, XeLaTeX (TeX Live/MiKTeX), the Crimson Text font (Google Fonts), Python 3.

## 1. Typography pass (straight quotes → curly, " - " → en dash, ... → ellipsis)

```bash
python3 typo.py body_raw.md body.md
```

`typo.py`:
```python
import re, sys
s = open(sys.argv[1], encoding='utf-8').read()
s = s.replace('...', '…')
s = re.sub(r' - ', ' – ', s)
out=[]
for i,ch in enumerate(s):
    if ch == '"':
        prev = s[i-1] if i>0 else '\n'
        out.append('“' if (prev.isspace() or prev in '([—–') else '”')
    elif ch == "'":
        out.append('’')
    else:
        out.append(ch)
open(sys.argv[2],'w',encoding='utf-8').write(''.join(out))
```
Note: every `'` becomes `’`. That's right for dialect elisions ('eck, t'kettle) and apostrophes, but it won't produce opening single quotes. Afterwards, check that the number of “ and ” in each paragraph matches.

## 2. Print PDF (6×9", KDP paperback)

```bash
pandoc body.md -f markdown-smart -t latex --lua-filter=chapters.lua -o body.tex
xelatex book.tex
xelatex book.tex   # second run fills in the contents page numbers
```

`chapters.lua`:
```lua
function Header(el)
  local t = pandoc.utils.stringify(el.content)
  if el.level == 1 then
    local num, sub = t:match("^(Chapter %d+)%s*–%s*(.+)$")
    if not num then num, sub = t, "" end
    return pandoc.RawBlock('latex', '\\bookchapter{'..num..'}{'..sub..'}')
  elseif el.level == 2 then
    return pandoc.RawBlock('latex', '\\booksection{'..t..'}')
  end
end
function HorizontalRule()
  return pandoc.RawBlock('latex', '\\scenebreak')
end
```

`book.tex`:
```latex
\documentclass[12pt,twoside,openany]{book}
\usepackage[paperwidth=6in,paperheight=9in,inner=0.8in,outer=0.6in,top=0.75in,bottom=0.8in,headsep=0.25in,footskip=0.4in]{geometry}
\usepackage{fontspec}
\setmainfont{Crimson Text}[Ligatures=TeX, Numbers=OldStyle]
\newfontfamily\headfont{Crimson Text}[Numbers=Lining]
\usepackage{polyglossia}
\setdefaultlanguage[variant=british]{english}
\usepackage{microtype}
\usepackage{setspace}
\setstretch{1.12}
\setlength{\parindent}{1.3em}
\setlength{\parskip}{0pt}
\widowpenalty=10000 \clubpenalty=10000
\raggedbottom
\setlength{\emergencystretch}{3em}
\usepackage{fancyhdr}
\pagestyle{fancy}
\fancyhf{}
\renewcommand{\headrulewidth}{0pt}
\fancyhead[CE]{\small\itshape Matt Crumpet}
\fancyhead[CO]{\small\itshape A Shag for Christmas}
\fancyfoot[C]{\small\thepage}
\fancypagestyle{plain}{\fancyhf{}\fancyfoot[C]{\small\thepage}}
\usepackage{emptypage}
\usepackage[hidelinks]{hyperref}
\usepackage{tocloft}
\renewcommand{\cfttoctitlefont}{\hfill\headfont\Huge}
\renewcommand{\cftaftertoctitle}{\hfill}
\renewcommand{\cftchapfont}{\normalfont}
\renewcommand{\cftchappagefont}{\normalfont}
\renewcommand{\cftchapleader}{\cftdotfill{\cftdotsep}}
\setlength{\cftbeforechapskip}{3pt}
\setlength{\cftchapnumwidth}{0pt}
\newcommand{\bookchapter}[2]{%
  \chapter*{#1}%
  \addcontentsline{toc}{chapter}{#1\if\relax\detokenize{#2}\relax\else\ \ \textit{#2}\fi}%
  \markboth{}{}%
  \vspace*{-1.2em}{\centering\headfont\itshape\Large #2\par}%
  \vspace{0.6em}{\centering\rule{0.18\textwidth}{0.4pt}\par}\vspace{1.6em}%
  \noindent\ignorespaces}
\usepackage{titlesec}
\titleformat{\chapter}[display]{\centering\headfont}{}{0pt}{\Huge}
\titlespacing*{\chapter}{0pt}{0.9in}{1.2em}
\newcommand{\booksection}[1]{\par\vspace{1.5em}{\centering\headfont\Large\itshape #1\par}\vspace{1em}\noindent\ignorespaces}
\newcommand{\scenebreak}{\par\vspace{0.6em}{\centering *\quad*\quad*\par}\vspace{0.6em}\noindent\ignorespaces}
\providecommand{\tightlist}{}
\begin{document}
\frenchspacing
\frontmatter
\pagestyle{empty}
\begin{titlepage}
\centering\vspace*{2.2in}
{\headfont\fontsize{34}{40}\selectfont A Shag\\[4pt] for Christmas\par}
\vspace{0.35in}\rule{0.3\textwidth}{0.4pt}\par\vspace{0.35in}
{\headfont\Large Matt Crumpet\par}
\end{titlepage}
\cleardoublepage
\pagestyle{plain}
\tableofcontents
\cleardoublepage
\mainmatter
\pagestyle{fancy}\fancyhf{}
\fancyhead[CE]{\small\itshape Matt Crumpet}
\fancyhead[CO]{\small\itshape A Shag for Christmas}
\fancyfoot[C]{\small\thepage}
\input{body.tex}
\end{document}
```

Notes on the PDF:
- The headers are set twice, once in the preamble and again after `\mainmatter`. The second set is needed, because the headers didn't show in the main text when they were only set in the preamble.
- `\frenchspacing` stops the extra-wide gap after full stops.
- `openany` starts chapters on whichever page comes next. Change it to `openright` to start chapters only on right-hand pages, which adds roughly a dozen blank pages.
- The KDP check is `pdffonts book.pdf`: every font should say "emb yes".

## 3. Kindle EPUB

```bash
pandoc body.md -f markdown-smart -t epub3 \
  --metadata-file=meta.yaml \
  --css=book.css \
  --epub-cover-image=kindle_cover.jpg \
  --toc --toc-depth=1 --split-level=1 \
  -o "A Shag For Christmas.epub"
```

`meta.yaml`:
```yaml
title: A Shag for Christmas
creator:
  - role: author
    text: Matt Crumpet
lang: en-GB
rights: © 2026 Matt Crumpet. All rights reserved.
```

`book.css`:
```css
body { font-family: serif; line-height: 1.4; }
p { text-indent: 1.3em; margin: 0; text-align: justify; }
h1 + p, h2 + p, hr + p { text-indent: 0; }
h1 { text-align: center; font-weight: normal; margin-top: 2em; margin-bottom: 1.5em; page-break-before: always; }
h2 { text-align: center; font-style: italic; font-weight: normal; margin: 1.5em 0 1em; }
hr { border: none; text-align: center; margin: 1em 0; height: 1.5em; }
hr:after { content: "* * *"; }
```

Validate with EPUBCheck (`pip install epubcheck`, then `python -m epubcheck book.epub`). The Kindle cover is 1600×2560 px, made by cropping the front panel of the print cover.

## 4. Paperback cover spec (KDP)

- Wrap width = 0.125 + 6 + spine + 6 + 0.125 in; height = 0.125 + 9 + 0.125 in.
- Spine width = pages × 0.0025 in on cream paper (× 0.002252 on white). 108 pages on cream gives 0.27 in.
- Render at 300 DPI and export a single-page PDF.
- Keep the bottom right of the back cover (about 2 × 1.2 in, 0.25 in in from the trim edges) clear for KDP's barcode.