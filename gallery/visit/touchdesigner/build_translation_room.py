"""
PROPORTION PIECE / The Translation Room — TouchDesigner Phase 1

Run INSIDE TouchDesigner as a Text DAT (paste script into a Text DAT and click
"Run Script"). Builds a real TOP network in /project1/pp_translation_room.
No TouchDesigner process is needed at gallery runtime.

Artwork: Golden Trajectories — Oil Paint Study 14, 27 October 2026.
Seed: OL-20261027-02-57201
Golden angle: 94%, phi strength: 97%, spiral influence: 55%.
Render target: 1152x240, 24fps, VP9/WebM, 20 second silent loop.

After inspecting the network, click Record on moviefileout1 for ~20 seconds
and switch it off. Save as phase-one-triptych.webm and publish it in the same
folder as phase-one.json. Set the manifest status to "published" ONLY once
the encoded movie is present and its dimensions have been checked.
"""

# Built-in TouchDesigner operator classes are available in its Python console.
# This script cannot execute in normal Python; open it in a TouchDesigner Text DAT.

SOURCE_IMAGE = (
    'https://southernadd-cmyk.github.io/algoart/gallery/2026-10-27/'
    '2026-10-27-oil-landscape-02-spiral-OL-20261027-02-57201.jpg'
)
SEED = 'OL-20261027-02-57201'
PHI_STRENGTH = 0.97
GOLDEN_ANGLE = 0.94
SPIRAL_INFLUENCE = 0.55
OUTPUT_FILE = 'phase-one-triptych.webm'
PANEL_W, PANEL_H, FPS = 384, 240, 24

def set_par(node, name, value):
    """Permit older/newer TD builds to skip optional parameters."""
    par = getattr(node.par, name, None)
    if par is None:
        print('Optional parameter unavailable:', node.name, name)
        return False
    try:
        par.val = value
        return True
    except Exception as exc:
        print('Parameter was not accepted:', node.name, name, exc)
        return False

def set_expr(node, name, expression):
    par = getattr(node.par, name, None)
    if par is None:
        print('Optional animated parameter unavailable:', node.name, name)
        return
    try:
        par.expr = expression
    except Exception as exc:
        print('Animation expression unavailable:', node.name, name, exc)

def connect(node, source, input_index=0):
    node.inputConnectors[input_index].connect(source)

def panel_resolution(node, w=PANEL_W, h=PANEL_H):
    set_par(node, 'outputresolution', 'custom')
    set_par(node, 'resolutionw', w)
    set_par(node, 'resolutionh', h)

def build():
    project = op('/project1')
    if project is None:
        raise RuntimeError('Cannot find /project1 in TouchDesigner')
    prior = project.op('pp_translation_room')
    if prior is not None:
        prior.destroy()
    room = project.create(baseCOMP, 'pp_translation_room')
    room.nodeX, room.nodeY = 0, 0

    # PANEL 1: preserve the actual artwork as the legible source.
    image = room.create(moviefileinTOP, 'source_golden_trajectories')
    image.nodeX, image.nodeY = 0, 0
    set_par(image, 'file', SOURCE_IMAGE)
    source = room.create(transformTOP, 'panel_01_source')
    source.nodeX, source.nodeY = 210, 0
    connect(source, image)
    panel_resolution(source)

    # PANEL 2: let TD reinterpret the source as a network of contour marks.
    edge = room.create(edgeTOP, 'panel_02_translation')
    edge.nodeX, edge.nodeY = 210, -175
    connect(edge, image)
    panel_resolution(edge)
    set_par(edge, 'select', 'luminance')
    set_par(edge, 'combineinput', 'compedge')
    set_par(edge, 'strength', 1.1 + PHI_STRENGTH * 1.1)
    set_par(edge, 'edgecolorr', .22)
    set_par(edge, 'edgecolorg', .42)
    set_par(edge, 'edgecolorb', .46)
    set_par(edge, 'edgecolora', .9)

    # PANEL 3: temporal emergence, driven by moving noise and feedback.
    field = room.create(noiseTOP, 'golden_angle_field')
    field.nodeX, field.nodeY = 0, -370
    panel_resolution(field)
    # The controls are directly tied to the original artwork settings.
    set_par(field, 'period', 3.0 - SPIRAL_INFLUENCE)
    set_expr(field, 'tz', 'absTime.seconds * ' + str(.08 + .10 * GOLDEN_ANGLE))
    set_expr(field, 'translatez', 'absTime.seconds * ' + str(.08 + .10 * GOLDEN_ANGLE))

    displacement = room.create(displaceTOP, 'warp_by_golden_field')
    displacement.nodeX, displacement.nodeY = 210, -370
    connect(displacement, image, 0)
    connect(displacement, field, 1)
    panel_resolution(displacement)
    set_par(displacement, 'displaceweightx', .08 + .08 * SPIRAL_INFLUENCE)
    set_par(displacement, 'displaceweighty', .07 + .08 * SPIRAL_INFLUENCE)

    feedback = room.create(feedbackTOP, 'previous_frame')
    feedback.nodeX, feedback.nodeY = 420, -510
    connect(feedback, displacement)
    feedback_zoom = room.create(transformTOP, 'feedback_growth')
    feedback_zoom.nodeX, feedback_zoom.nodeY = 620, -510
    connect(feedback_zoom, feedback)
    panel_resolution(feedback_zoom)
    set_par(feedback_zoom, 'sx', 1.003 + PHI_STRENGTH*.002)
    set_par(feedback_zoom, 'sy', 1.003 + PHI_STRENGTH*.002)

    fade = room.create(levelTOP, 'feedback_decay')
    fade.nodeX, fade.nodeY = 810, -510
    connect(fade, feedback_zoom)
    set_par(fade, 'opacity', .76)

    emergence = room.create(compositeTOP, 'panel_03_emergence')
    emergence.nodeX, emergence.nodeY = 1020, -370
    connect(emergence, displacement, 0)
    connect(emergence, fade, 1)
    panel_resolution(emergence)
    set_par(emergence, 'operand', 'over')
    set_par(feedback, 'top', emergence.path)

    # Layout TOP makes the ACTUAL horizontal triptych in the licensed TD
    # renderer. One WebM later drives all three monitor panels in Three.js.
    layout = room.create(layoutTOP, 'triptych_1152x240')
    layout.nodeX, layout.nodeY = 1210, -80
    set_par(layout, 'top', ' '.join([source.path, edge.path, emergence.path]))
    set_par(layout, 'align', 'horizlr')
    set_par(layout, 'fit', 'fitbest')
    panel_resolution(layout, PANEL_W*3, PANEL_H)

    output = room.create(outTOP, 'out1')
    output.nodeX, output.nodeY = 1430, -80
    connect(output, layout)

    record = room.create(moviefileoutTOP, 'moviefileout1')
    record.nodeX, record.nodeY = 1430, -270
    connect(record, layout)
    set_par(record, 'file', OUTPUT_FILE)
    set_par(record, 'type', 'movie')
    set_par(record, 'videocodec', 'vp9')
    set_par(record, 'moviecontainer', 'webm')
    set_par(record, 'fps', FPS)
    set_par(record, 'record', False)
    print('Created', room.path)
    print('Source study:', SOURCE_IMAGE)
    print('Inspect triptych_1152x240 and ensure image source loads.')
    print('Set timeline FPS to 24. Record for 20 seconds, then stop.')
    print('Expected export:', OUTPUT_FILE)
    print('IMPORTANT: do not publish the manifest before the WebM exists.')
    return room

build()
