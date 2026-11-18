// MzPedal - Created by Simon Moscrop
// Free software under the GNU AGPL v3; see LICENSE.
//
// Stripboard layouts, as data: drawn to SVG, and checked against the circuit they are meant
// to be - every pin of a net joined to every other, no two nets touching, no two parts in one
// hole, no part lying across another's leads.
//
// A board is columns x rows of holes; the copper strips run along the rows. Holes are
// [column, row], both from 1, column 1 at the left and row 1 at the top, seen from the
// component side.

const letters = (c) => {
    let s = '';
    for (let n = c; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
    return s;
};
export const hole = (c, r) => `${letters(c)}${r}`;

//
// The checks. Returns a list of problems; empty if the board is the circuit.
//
export function check(board) {
    const problems = [];
    const key = (c, r) => `${c},${r}`;
    const cut = new Set(board.cuts.map(([c, r]) => key(c, r)));

    // which strip segment a hole is on: a row, between cuts
    const segmentOf = (c, r) => {
        if (cut.has(key(c, r))) return null;
        let from = c;
        while (from > 1 && !cut.has(key(from - 1, r))) from--;
        return `r${r}:${from}`;
    };

    // union-find over segments, joined by links
    const parent = new Map();
    const find = (x) => { while (parent.has(x) && parent.get(x) !== x) x = parent.get(x); return x; };
    const join = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent.set(ra, rb); };

    // every lead's hole, once
    const used = new Map();
    const take = (c, r, who) => {
        if (c < 1 || r < 1 || c > board.cols || r > board.rows) { problems.push(`${who}: ${hole(c, r)} is off the board`); return; }
        if (cut.has(key(c, r))) problems.push(`${who}: ${hole(c, r)} is a cut`);
        const k = key(c, r);
        if (used.has(k)) problems.push(`${who} and ${used.get(k)} share ${hole(c, r)}`);
        used.set(k, who);
    };

    for (const l of board.links) {
        const [c1, r1, c2, r2] = l;
        take(c1, r1, `link ${hole(c1, r1)}-${hole(c2, r2)}`);
        take(c2, r2, `link ${hole(c1, r1)}-${hole(c2, r2)}`);
        const a = segmentOf(c1, r1), b = segmentOf(c2, r2);
        if (a && b) join(a, b);
    }

    // the pins, by the net each is meant to be on
    const pins = [];
    for (const p of board.parts) for (const [c, r, net, name] of p.pins) {
        take(c, r, `${p.ref}${name ? '.' + name : ''}`);
        pins.push({ who: `${p.ref}${name ? '.' + name : ''}`, c, r, net });
    }
    for (const p of board.pads) {
        take(p.c, p.r, `pad ${p.label}`);
        pins.push({ who: `pad ${p.label}`, c: p.c, r: p.r, net: p.net });
    }

    // nets to their connected groups
    const groupOfNet = new Map(), netOfGroup = new Map();
    for (const p of pins) {
        const s = segmentOf(p.c, p.r);
        if (!s) continue;
        const g = find(s);
        if (groupOfNet.has(p.net) && groupOfNet.get(p.net) !== g)
            problems.push(`net ${p.net} is in two pieces: ${p.who} at ${hole(p.c, p.r)} is not joined to the rest`);
        else groupOfNet.set(p.net, g);
        if (netOfGroup.has(g) && netOfGroup.get(g) !== p.net)
            problems.push(`nets ${netOfGroup.get(g)} and ${p.net} touch, at ${p.who} ${hole(p.c, p.r)}`);
        else netOfGroup.set(g, p.net);
    }

    // a part's body lies over the holes between its end leads: nobody else's lead may be there,
    // and two bodies on the same line may not overlap
    const bodies = [];
    const lineOf = (who, a, b) => {
        const [c1, r1] = a, [c2, r2] = b;
        if (c1 !== c2 && r1 !== r2) return;   // a diagonal: not checked
        const cells = [];
        if (c1 === c2) for (let r = Math.min(r1, r2) + 1; r < Math.max(r1, r2); r++) cells.push(key(c1, r));
        else for (let c = Math.min(c1, c2) + 1; c < Math.max(c1, c2); c++) cells.push(key(c, r1));
        bodies.push({ who, cells });
    };
    for (const p of board.parts) if (p.pins.length === 2) lineOf(p.ref, p.pins[0], p.pins[1]);
    for (const l of board.links) lineOf(`link ${hole(l[0], l[1])}`, [l[0], l[1]], [l[2], l[3]]);
    for (const b of bodies) for (const k of b.cells)
        if (used.has(k)) {
            const [c, r] = k.split(',').map(Number);
            problems.push(`${b.who} lies over ${used.get(k)} at ${hole(c, r)}`);
        }
    for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) {
        const s = new Set(bodies[i].cells);
        const k = bodies[j].cells.find((x) => s.has(x));
        if (k) { const [c, r] = k.split(',').map(Number); problems.push(`${bodies[i].who} and ${bodies[j].who} cross at ${hole(c, r)}`); }
    }

    // two-lead parts too short for their bodies
    for (const p of board.parts) {
        if (!p.min || p.pins.length !== 2) continue;
        const [a, b] = p.pins;
        const span = Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
        if (span < p.min) problems.push(`${p.ref} spans ${span} holes; it needs ${p.min}`);
    }
    return problems;
}

//
// The drawing: the component side, the strips showing through, cuts as red crosses.
//
const P = 10;          // one hole's pitch, in drawing units
const M = 26;          // the margin, for the labels

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function draw(board) {
    const W = board.cols * P + 2 * M + (board.legendWidth || 0), H = board.rows * P + 2 * M + 30;
    const x = (c) => M + (c - 0.5) * P, y = (r) => M + 22 + (r - 0.5) * P;
    const o = [];
    o.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W * 2.2}" height="${H * 2.2}" font-family="Helvetica, Arial, sans-serif">`);
    o.push(`<rect width="${W}" height="${H}" fill="#ffffff"/>`);
    o.push(`<text x="${M}" y="14" font-size="9" font-weight="bold">${esc(board.title)}</text>`);
    o.push(`<text x="${M}" y="24" font-size="5" fill="#444">${esc(board.subtitle || 'Component side. Copper strips run left to right. Red crosses: cut the strip at that hole.')}</text>`);

    // the board and its strips
    o.push(`<rect x="${M - 3}" y="${y(1) - P / 2 - 3}" width="${board.cols * P + 6}" height="${board.rows * P + 6}" fill="#e9d8b4" stroke="#8a7650" stroke-width="0.6" rx="2"/>`);
    for (let r = 1; r <= board.rows; r++)
        o.push(`<rect x="${x(1) - P / 2 + 0.6}" y="${y(r) - 3.3}" width="${board.cols * P - 1.2}" height="6.6" fill="#e3a868" opacity="0.55"/>`);
    for (let r = 1; r <= board.rows; r++) for (let c = 1; c <= board.cols; c++)
        o.push(`<circle cx="${x(c)}" cy="${y(r)}" r="0.9" fill="#6b5536"/>`);

    // the grid's labels: columns lettered, rows numbered
    for (let c = 1; c <= board.cols; c++) {
        o.push(`<text x="${x(c)}" y="${y(1) - P / 2 - 5}" font-size="3.6" text-anchor="middle" fill="#666">${letters(c)}</text>`);
        o.push(`<text x="${x(c)}" y="${y(board.rows) + P / 2 + 8}" font-size="3.6" text-anchor="middle" fill="#666">${letters(c)}</text>`);
    }
    for (let r = 1; r <= board.rows; r++) {
        o.push(`<text x="${M - 7}" y="${y(r) + 1.3}" font-size="3.6" text-anchor="end" fill="#666">${r}</text>`);
        o.push(`<text x="${x(board.cols) + P / 2 + 6}" y="${y(r) + 1.3}" font-size="3.6" fill="#666">${r}</text>`);
    }

    // cuts
    for (const [c, r] of board.cuts) {
        const cx = x(c), cy = y(r), d = 2.8;
        o.push(`<path d="M${cx - d} ${cy - d}L${cx + d} ${cy + d}M${cx - d} ${cy + d}L${cx + d} ${cy - d}" stroke="#d01010" stroke-width="1.2"/>`);
    }

    // links: bare wire
    for (const [c1, r1, c2, r2] of board.links) {
        o.push(`<line x1="${x(c1)}" y1="${y(r1)}" x2="${x(c2)}" y2="${y(r2)}" stroke="#555" stroke-width="1.1"/>`);
        o.push(`<circle cx="${x(c1)}" cy="${y(r1)}" r="1.4" fill="#555"/><circle cx="${x(c2)}" cy="${y(r2)}" r="1.4" fill="#555"/>`);
    }

    // parts
    for (const p of board.parts) o.push(drawPart(p, x, y));

    // pads for wires off the board
    for (const p of board.pads) {
        o.push(`<circle cx="${x(p.c)}" cy="${y(p.r)}" r="2.4" fill="#fff" stroke="#1a5fb4" stroke-width="1"/>`);
        o.push(`<circle cx="${x(p.c)}" cy="${y(p.r)}" r="0.9" fill="#1a5fb4"/>`);
        o.push(`<text x="${x(p.c) + 2.6}" y="${y(p.r) - 2.6}" font-size="3.3" fill="#1a5fb4" font-weight="bold">${esc(p.tag)}</text>`);
    }

    // the key: the parts, the wires off the board, and notes - in two columns beside it
    const columnWidth = 118;
    let lx = M + board.cols * P + 22, ly = y(1);
    const heading = (s) => { o.push(`<text x="${lx}" y="${ly}" font-size="5" font-weight="bold">${esc(s)}</text>`); ly += 7; };
    const line = (s, tag) => {
        if (ly > y(board.rows) + 4) { lx += columnWidth; ly = y(1); }
        if (tag) o.push(`<text x="${lx}" y="${ly}" font-size="3.8" font-weight="bold" fill="#1a5fb4">${esc(tag)}</text>`);
        o.push(`<text x="${lx + (tag ? 13 : 0)}" y="${ly}" font-size="3.8">${esc(s)}</text>`);
        ly += 5.2;
    };
    heading('Parts');
    const order = (a, b) => a.ref.replace(/\d+/g, (n) => n.padStart(3, '0')).localeCompare(b.ref.replace(/\d+/g, (n) => n.padStart(3, '0')));
    for (const p of [...board.parts].sort(order)) line(`${p.value}${p.note ? ' - ' + p.note : ''}`, p.ref);
    ly += 3;
    if (ly > y(board.rows) - 10) { lx += columnWidth; ly = y(1); }
    heading('Wires off the board');
    for (const p of board.pads) line(p.label, p.tag);
    if (board.notes) {
        ly += 3;
        if (ly > y(board.rows) - 10) { lx += columnWidth; ly = y(1); }
        heading('Notes');
        for (const s of board.notes) line(s);
    }
    o.push('</svg>');
    return o.join('\n');
}

function drawPart(p, x, y) {
    const o = [];
    const pts = p.pins.map(([c, r]) => [x(c), y(r)]);
    const label = (tx, ty, anchor = 'middle', size = 3.6) =>
        `<text x="${tx}" y="${ty}" font-size="${size}" text-anchor="${anchor}" fill="#111" font-weight="bold">${esc(p.ref)}</text>`;
    const lead = (a, b) => `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="#777" stroke-width="0.7"/>`;
    const dot = ([px, py]) => `<circle cx="${px}" cy="${py}" r="1.2" fill="#333"/>`;

    if (['R', 'C', 'E', 'D'].includes(p.type)) {
        const [a, b] = pts;
        const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
        const vertical = a[0] === b[0];
        o.push(lead(a, b), dot(a), dot(b));
        if (p.type === 'R') {
            const w = vertical ? 3.4 : 11, h = vertical ? 11 : 3.4;
            o.push(`<rect x="${mx - w / 2}" y="${my - h / 2}" width="${w}" height="${h}" rx="1.2" fill="#d9c79a" stroke="#6a5a30" stroke-width="0.5"/>`);
        } else if (p.type === 'C') {
            const w = vertical ? 5 : 3, h = vertical ? 3 : 5;
            o.push(`<rect x="${mx - w / 2}" y="${my - h / 2}" width="${w}" height="${h}" rx="0.6" fill="#e8c35a" stroke="#8a6d10" stroke-width="0.5"/>`);
        } else if (p.type === 'E') {
            o.push(`<circle cx="${mx}" cy="${my}" r="3.6" fill="#2b4f8c" stroke="#13284a" stroke-width="0.5"/>`);
            const [px, py] = a;   // the + lead is the first
            o.push(`<text x="${px + (vertical ? 3 : 0)}" y="${py + (vertical ? 1.2 : -2.5)}" font-size="4" font-weight="bold" fill="#c00000">+</text>`);
        } else if (p.type === 'D') {
            const w = vertical ? 3 : 8, h = vertical ? 8 : 3;
            o.push(`<rect x="${mx - w / 2}" y="${my - h / 2}" width="${w}" height="${h}" rx="0.6" fill="${p.fill || '#c0392b'}" stroke="#333" stroke-width="0.4"/>`);
            // the band, at the cathode - the second lead
            const [kx, ky] = b;
            if (vertical) { const by = my + Math.sign(ky - my) * (h / 2 - 1); o.push(`<rect x="${mx - w / 2}" y="${by - 0.8}" width="${w}" height="1.6" fill="#eee"/>`); }
            else { const bx = mx + Math.sign(kx - mx) * (w / 2 - 1); o.push(`<rect x="${bx - 0.8}" y="${my - h / 2}" width="1.6" height="${h}" fill="#eee"/>`); }
        }
        o.push(vertical ? (p.labelLeft ? label(mx - 3, my + 1.2, 'end') : label(mx + 5, my + 1.2, 'start')) : label(mx, my - 4));
    } else if (p.type === 'Q') {
        // TO-92, leads in a column, E B C as listed. Seen from the flat face, E B C read left to
        // right: with C above E on the drawing, that face is to the right.
        const [e, , c] = pts;
        const flatRight = c[1] < e[1];
        const mx = e[0], top = Math.min(e[1], c[1]) - 2.5, bot = Math.max(e[1], c[1]) + 2.5;
        const fx = flatRight ? mx + 1.8 : mx - 1.8;
        o.push(`<path d="M${fx} ${top} L${fx} ${bot} A 3.6 ${(bot - top) / 2} 0 0 ${flatRight ? 1 : 0} ${fx} ${top} Z" fill="#333" opacity="0.85"/>`);
        pts.forEach((pt, i) => { o.push(dot(pt)); o.push(`<text x="${pt[0] - 1}" y="${pt[1] + 1.1}" font-size="2.6" fill="#fff">${'EBC'[i]}</text>`); });
        o.push(label(mx - 5, top - 1, 'end'));
        o.push(`<text x="${fx + (flatRight ? 1.5 : -1.5)}" y="${(top + bot) / 2 + 1}" font-size="2.4" text-anchor="${flatRight ? 'start' : 'end'}" fill="#555">flat</text>`);
    } else if (p.type === 'IC' || p.type === 'K') {
        const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
        const x0 = Math.min(...xs) - 3.5, x1 = Math.max(...xs) + 3.5, y0 = Math.min(...ys) - 4, y1 = Math.max(...ys) + 4;
        o.push(`<rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" rx="1" fill="${p.type === 'K' ? '#3b6ea8' : '#2a2a2a'}" opacity="0.88"/>`);
        // pin 1's end, marked
        o.push(`<path d="M${(x0 + x1) / 2 - 2.5} ${y0} A 2.5 2.5 0 0 0 ${(x0 + x1) / 2 + 2.5} ${y0}" fill="#fff"/>`);
        p.pins.forEach(([c, r, , name], i) => {
            const [px, py] = pts[i];
            o.push(`<circle cx="${px}" cy="${py}" r="1.3" fill="#ddd"/>`);
            const left = px < (x0 + x1) / 2;
            o.push(`<text x="${px + (left ? 2.2 : -2.2)}" y="${py + 1.1}" font-size="2.7" fill="#fff" text-anchor="${left ? 'start' : 'end'}">${esc(name)}</text>`);
        });
        o.push(`<text x="${(x0 + x1) / 2}" y="${(y0 + y1) / 2 + 1.5}" font-size="3.6" text-anchor="middle" fill="#fff" font-weight="bold">${esc(p.ref)}</text>`);
        if (p.value) o.push(`<text x="${(x0 + x1) / 2}" y="${(y0 + y1) / 2 + 5.5}" font-size="2.8" text-anchor="middle" fill="#fff">${esc(p.value)}</text>`);
    }
    return o.join('');
}
