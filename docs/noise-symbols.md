# Noise-source symbols

In **Sources**, choose **V Noise** (`v_noise`) or **I Noise** (`i_noise`).
The default labels `v_n` and `i_n` render with a subscript and can be edited in
the `display` property. Both have two electrical pins: `+` at `(0, -40)` and
`-` at `(0, 40)`. Rotate and mirror them as other components.

The artwork follows the conventional representations in Behzad Razavi,
*Design of Analog CMOS Integrated Circuits*, second edition, Chapter 7,
official companion slides **22** (series noise voltage) and **26** (parallel
noise current). The voltage symbol has a blank circle with external polarity;
the current symbol has a downward reference arrow, from `+` to `-`.
The polarity/direction is a reference, rather than a DC bias.

Source: [Razavi's official teaching page](https://www.seas.ucla.edu/brweb/teaching.html),
[second-edition slides](https://www.seas.ucla.edu/brweb/teaching/2eSlides.zip),
`Slides/Ch7_slides.ppt`. The graphics here are newly written SVG primitives;
no book scan, slide image or extracted artwork is bundled.

These symbols support editable noise-analysis diagrams and SVG/raster/PDF
exports. They do not synthesize random waveforms or set a noise spectral
density. SPICE/Spectre export includes an explicit placeholder comment and
the check report warns that a simulator-specific noise model is needed.
A commented voltage noise source does not connect its two nodes in a simulator.
