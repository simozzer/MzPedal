// MzPedal - Created by Simon Moscrop
// Free software under the GNU AGPL v3; see LICENSE.
//
// A small kit for drawing schematics as SVG: wires, rails, the usual symbols, and boxes for
// modules. Coordinates are in drawing units; a sheet is drawn 1.6 times that, in pixels.

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export class Sheet {
    constructor(w, h, title, subtitle) {
        this.o = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w * 1.6}" height="${h * 1.6}" font-family="Helvetica, Arial, sans-serif">`,
                  `<rect width="${w}" height="${h}" fill="#fff"/>`,
                  `<text x="16" y="24" font-size="15" font-weight="bold">${esc(title)}</text>`];
        if (subtitle) this.o.push(`<text x="16" y="40" font-size="9.5" fill="#444">${esc(subtitle)}</text>`);
    }
    add(s) { this.o.push(s); return this; }
    done() { return this.o.join('\n') + '\n</svg>'; }

    path(pts) { return pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(''); }
    wire(...pts) { return this.add(`<path d="${this.path(pts)}" fill="none" stroke="#000" stroke-width="1.2"/>`); }
    dashed(...pts) { return this.add(`<path d="${this.path(pts)}" fill="none" stroke="#666" stroke-width="1" stroke-dasharray="4 3"/>`); }
    dot(x, y) { return this.add(`<circle cx="${x}" cy="${y}" r="2.6" fill="#000"/>`); }
    text(x, y, s, { size = 9, anchor = 'start', weight = 'normal', fill = '#000', italic = false } = {}) {
        return this.add(`<text x="${x}" y="${y}" font-size="${size}" text-anchor="${anchor}" font-weight="${weight}" fill="${fill}"${italic ? ' font-style="italic"' : ''}>${esc(s)}</text>`);
    }
    note(x, y, lines, size = 8.5, fill = '#333') {
        lines.forEach((l, i) => this.text(x, y + i * (size + 3.5), l, { size, fill }));
        return this;
    }
    // a net's name, where a wire ends: the same name elsewhere is the same wire
    net(x, y, name, anchor = 'start') {
        return this.text(x + (anchor === 'end' ? -3 : 3), y + 3, name, { size: 8.5, fill: '#1a5fb4', weight: 'bold', anchor });
    }
    frame(x, y, w, h, title) {
        this.add(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="#9aa" stroke-width="1" stroke-dasharray="6 4" rx="6"/>`);
        return this.text(x + 8, y + 15, title, { size: 10, weight: 'bold', fill: '#567' });
    }

    gnd(x, y) {
        return this.add(`<path d="M${x} ${y}V${y + 7}M${x - 8} ${y + 7}H${x + 8}M${x - 5} ${y + 10.5}H${x + 5}M${x - 2} ${y + 14}H${x + 2}" stroke="#000" stroke-width="1.2" fill="none"/>`);
    }
    rail(x, y, name) {
        this.add(`<path d="M${x} ${y}V${y - 8}M${x - 7} ${y - 8}H${x + 7}" stroke="#000" stroke-width="1.2"/>`);
        return this.text(x, y - 11, name, { size: 8.5, anchor: 'middle', weight: 'bold' });
    }

    // a two-lead part between two points on a line; its body in the middle, its leads to the ends
    two(x1, y1, x2, y2, body, ref, value, labelLeft = false) {
        const vertical = x1 === x2;
        const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
        const s = Math.sign(vertical ? y2 - y1 : x2 - x1);
        if (vertical) this.wire([x1, y1], [x1, my - s * 15]).wire([x1, my + s * 15], [x2, y2]);
        else this.wire([x1, y1], [mx - s * 15, y1]).wire([mx + s * 15, y1], [x2, y2]);
        body(mx, my, vertical, s);
        if (vertical) {
            const tx = labelLeft ? mx - 10 : mx + 10, a = labelLeft ? 'end' : 'start';
            this.text(tx, my - 2, ref, { size: 8.5, weight: 'bold', anchor: a });
            if (value) this.text(tx, my + 9, value, { size: 8.5, anchor: a });
        } else {
            this.text(mx, my - 10, ref, { size: 8.5, anchor: 'middle', weight: 'bold' });
            if (value) this.text(mx, my + 18, value, { size: 8.5, anchor: 'middle' });
        }
        return this;
    }
    res(x1, y1, x2, y2, ref, value, labelLeft) {
        return this.two(x1, y1, x2, y2, (mx, my, v) => {
            const w = v ? 9 : 30, h = v ? 30 : 9;
            this.add(`<rect x="${mx - w / 2}" y="${my - h / 2}" width="${w}" height="${h}" fill="#fff" stroke="#000" stroke-width="1.2"/>`);
        }, ref, value, labelLeft);
    }
    // a capacitor; polarised, its first point is +
    cap(x1, y1, x2, y2, ref, value, polarised = false, labelLeft) {
        return this.two(x1, y1, x2, y2, (mx, my, v, s) => {
            if (v) {
                this.wire([mx, my - 15], [mx, my - 3]).wire([mx, my + 3], [mx, my + 15]);
                this.add(`<path d="M${mx - 9} ${my - 3}H${mx + 9}M${mx - 9} ${my + 3}H${mx + 9}" stroke="#000" stroke-width="2"/>`);
                if (polarised) this.text(labelLeft ? mx + 11 : mx - 15, my - 6 * s + 3, '+', { size: 10, weight: 'bold', fill: '#c00' });
            } else {
                this.wire([mx - 15, my], [mx - 3, my]).wire([mx + 3, my], [mx + 15, my]);
                this.add(`<path d="M${mx - 3} ${my - 9}V${my + 9}M${mx + 3} ${my - 9}V${my + 9}" stroke="#000" stroke-width="2"/>`);
                if (polarised) this.text(mx - 9 * s, my - 11, '+', { size: 10, weight: 'bold', fill: '#c00', anchor: 'middle' });
            }
        }, ref, value, labelLeft);
    }
    // a diode, anode first; an LED with its arrows
    diode(x1, y1, x2, y2, ref, value, led = false, labelLeft) {
        return this.two(x1, y1, x2, y2, (mx, my, v, s) => {
            if (v) {
                this.wire([mx, my - 15], [mx, my + 15]);
                const a = my - 6 * s, k = my + 6 * s;
                this.add(`<path d="M${mx - 7} ${a}H${mx + 7}L${mx} ${k}Z" fill="#000"/><path d="M${mx - 7} ${k}H${mx + 7}" stroke="#000" stroke-width="1.6"/>`);
                if (led) {
                    const ax = labelLeft ? mx + 9 : mx - 16;
                    this.add(`<path d="M${ax} ${my - 2}l7 -6m-3 0h3v3M${ax} ${my + 4}l7 -6m-3 0h3v3" stroke="#000" stroke-width="0.9" fill="none"/>`);
                }
            } else {
                this.wire([mx - 15, my], [mx + 15, my]);
                const a = mx - 6 * s, k = mx + 6 * s;
                this.add(`<path d="M${a} ${my - 7}V${my + 7}L${k} ${my}Z" fill="#000"/><path d="M${k} ${my - 7}V${my + 7}" stroke="#000" stroke-width="1.6"/>`);
                if (led) this.add(`<path d="M${mx - 2} ${my + 9}l6 7m-3 0h3v-3M${mx + 4} ${my + 9}l6 7m-3 0h3v-3" stroke="#000" stroke-width="0.9" fill="none"/>`);
            }
        }, ref, value, labelLeft);
    }
    // a switch, drawn open
    sw(x1, y1, x2, y2, ref, value, labelLeft) {
        return this.two(x1, y1, x2, y2, (mx, my, v) => {
            if (v) {
                this.add(`<circle cx="${mx}" cy="${my - 12}" r="2" fill="#fff" stroke="#000"/><circle cx="${mx}" cy="${my + 12}" r="2" fill="#fff" stroke="#000"/>`);
                this.wire([mx, my - 15], [mx, my - 14]).wire([mx, my + 14], [mx, my + 15]).wire([mx, my + 10], [mx + (labelLeft ? 10 : -10), my - 10]);
            } else {
                this.add(`<circle cx="${mx - 12}" cy="${my}" r="2" fill="#fff" stroke="#000"/><circle cx="${mx + 12}" cy="${my}" r="2" fill="#fff" stroke="#000"/>`);
                this.wire([mx - 15, my], [mx - 14, my]).wire([mx + 14, my], [mx + 15, my]).wire([mx - 10, my], [mx + 10, my - 10]);
            }
        }, ref, value, labelLeft);
    }
    // a potentiometer, vertical, with its wiper to the right
    pot(x, y1, y2, ref, value) {
        this.res(x, y1, x, y2, '', '');
        const my = (y1 + y2) / 2;
        this.add(`<path d="M${x + 22} ${my}H${x + 6}l5 -4m-5 4l5 4" stroke="#000" fill="none" stroke-width="1.2"/>`);
        this.text(x - 9, my - 2, ref, { size: 8.5, weight: 'bold', anchor: 'end' }).text(x - 9, my + 9, value, { size: 8.5, anchor: 'end' });
        return { wiper: [x + 22, my] };
    }

    // an op-amp: - input at top left, + at bottom left, output at the right; its name below
    opamp(x, y, ref, value) {
        this.add(`<path d="M${x} ${y - 28}V${y + 28}L${x + 50} ${y}Z" fill="#fff" stroke="#000" stroke-width="1.3"/>`);
        this.text(x + 5, y - 9, '−', { size: 12 }).text(x + 5, y + 18, '+', { size: 11 });
        this.text(x + 2, y + 42, ref, { size: 8.5, weight: 'bold' }).text(x + 2, y + 53, value, { size: 8 });
        return { minus: [x, y - 13], plus: [x, y + 13], out: [x + 50, y] };
    }
    // an NPN: base left, collector up, emitter down
    npn(x, y, ref, value) {
        this.add(`<circle cx="${x}" cy="${y}" r="15" fill="none" stroke="#000" stroke-width="1.1"/>`);
        this.wire([x - 22, y], [x - 6, y]);
        this.add(`<path d="M${x - 6} ${y - 9}V${y + 9}" stroke="#000" stroke-width="2.2"/>`);
        this.wire([x - 6, y - 4], [x + 8, y - 13], [x + 8, y - 24]);
        this.wire([x - 6, y + 4], [x + 8, y + 13], [x + 8, y + 24]);
        this.add(`<path d="M${x + 8} ${y + 13}l-7 -1.5l3 -5z" fill="#000"/>`);
        this.text(x + 18, y - 2, ref, { size: 8.5, weight: 'bold' }).text(x + 18, y + 9, value, { size: 8.5 });
        return { b: [x - 22, y], c: [x + 8, y - 24], e: [x + 8, y + 24] };
    }
    // a changeover contact: common at one side; NC (where it rests) and NO at the other
    spdt(x, y, ref, flip = false) {
        const d = flip ? -1 : 1;
        this.add(`<circle cx="${x}" cy="${y}" r="2" fill="#000"/>`);
        this.add(`<circle cx="${x + 34 * d}" cy="${y - 11}" r="2" fill="#fff" stroke="#000"/><circle cx="${x + 34 * d}" cy="${y + 11}" r="2" fill="#fff" stroke="#000"/>`);
        this.wire([x, y], [x + 31 * d, y - 10]);
        this.text(x + 34 * d + 5 * d, y - 13, 'NC', { size: 7, anchor: flip ? 'end' : 'start', fill: '#555' });
        this.text(x + 34 * d + 5 * d, y + 18, 'NO', { size: 7, anchor: flip ? 'end' : 'start', fill: '#555' });
        this.text(x + 12 * d, y + 18, ref, { size: 8.5, weight: 'bold', anchor: 'middle' });
        return { com: [x, y], nc: [x + 34 * d, y - 11], no: [x + 34 * d, y + 11] };
    }
    // a 1/4" jack: tip and sleeve; its name beside it
    jack(x, y, name, right = false) {
        const d = right ? -1 : 1;
        this.add(`<path d="M${x} ${y}h${12 * d}l5 -6l5 6h${8 * d}" fill="none" stroke="#000" stroke-width="1.2"/>`);
        this.add(`<path d="M${x} ${y + 14}h${30 * d}" fill="none" stroke="#000" stroke-width="1.2"/>`);
        this.add(`<rect x="${right ? x : x - 10}" y="${y - 8}" width="10" height="26" fill="#ddd" stroke="#000"/>`);
        this.text(right ? x + 14 : x - 14, y + 8, name, { size: 9, weight: 'bold', anchor: right ? 'start' : 'end' });
        return { tip: [x + 30 * d, y], sleeve: [x + 30 * d, y + 14] };
    }
    // a module: a box with named pins; a name starting ~ is not printed. Pins on the top or
    // bottom are labelled outside the box, so the title stays clear.
    box(x, y, w, h, title, sub, pins = [], fill = '#f3f6fa') {
        this.add(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="${fill}" stroke="#345" stroke-width="1.2"/>`);
        this.text(x + w / 2, y + 16, title, { size: 10, weight: 'bold', anchor: 'middle' });
        if (sub) this.text(x + w / 2, y + 28, sub, { size: 8, anchor: 'middle', fill: '#456' });
        const at = {};
        for (const [side, name, off] of pins) {
            const px = side === 'left' ? x : side === 'right' ? x + w : x + off;
            const py = side === 'left' || side === 'right' ? y + off : side === 'top' ? y : y + h;
            this.add(`<circle cx="${px}" cy="${py}" r="2" fill="#345"/>`);
            if (!name.startsWith('~')) {
                if (side === 'left') this.text(px + 5, py + 3, name, { size: 8 });
                else if (side === 'right') this.text(px - 5, py + 3, name, { size: 8, anchor: 'end' });
                else if (side === 'top') this.text(px + 4, py - 4, name, { size: 8, fill: '#345' });
                else this.text(px + 4, py + 11, name, { size: 8, fill: '#345' });
            }
            at[name] = [px, py];
        }
        return at;
    }
}
