from __future__ import annotations

import math
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parent
BLEND_PATH = ROOT / "gitpulse-pulse-core.blend"
GLB_PATH = ROOT / "gitpulse-pulse-core.glb"
POSTER_PATH = ROOT / "gitpulse-pulse-core.webp"


def clear_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (bpy.data.curves, bpy.data.meshes, bpy.data.materials, bpy.data.cameras, bpy.data.lights):
        for datablock in list(datablocks):
            if datablock.users == 0:
                datablocks.remove(datablock)


def make_material(name: str, color: tuple[float, float, float, float], *, metallic: float, roughness: float, emission: tuple[float, float, float, float] | None = None) -> bpy.types.Material:
    material = bpy.data.materials.new(name)
    material.diffuse_color = color
    material.use_nodes = True
    nodes = material.node_tree.nodes
    shader = nodes.get("Principled BSDF")
    if shader is None:
        return material
    shader.inputs["Base Color"].default_value = color
    shader.inputs["Metallic"].default_value = metallic
    shader.inputs["Roughness"].default_value = roughness
    if emission:
        shader.inputs["Emission Color"].default_value = emission
        shader.inputs["Emission Strength"].default_value = 0.85
    return material


def make_root() -> bpy.types.Object:
    root = bpy.data.objects.new("PulseRoot", None)
    bpy.context.collection.objects.link(root)
    root.empty_display_type = "PLAIN_AXES"
    root.hide_render = True
    return root


def curve_object(name: str, points: list[tuple[float, float, float]], *, bevel: float, material: bpy.types.Material, parent: bpy.types.Object) -> bpy.types.Object:
    curve = bpy.data.curves.new(name, "CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = 10
    curve.bevel_depth = bevel
    curve.bevel_resolution = 3
    spline = curve.splines.new("BEZIER")
    spline.bezier_points.add(len(points) - 1)
    for bezier, point in zip(spline.bezier_points, points):
        bezier.co = point
        bezier.handle_left_type = "AUTO"
        bezier.handle_right_type = "AUTO"
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)
    obj.parent = parent
    return obj


def make_ring(material: bpy.types.Material, parent: bpy.types.Object) -> bpy.types.Object:
    points = []
    for index in range(57):
        angle = math.radians(38 + (284 * index / 56))
        points.append((2.12 * math.cos(angle), 2.12 * math.sin(angle), -0.08))
    return curve_object("Ring", points, bevel=0.115, material=material, parent=parent)


def make_rails(material: bpy.types.Material, parent: bpy.types.Object) -> list[bpy.types.Object]:
    paths = [
        [(-1.52, 0.35, 0.02), (-0.78, 0.35, 0.02), (-0.52, 0.98, 0.02)],
        [(-1.52, 0.35, 0.02), (-0.82, -0.42, 0.02), (-0.56, -1.13, 0.02)],
        [(-0.52, 0.98, 0.02), (-0.52, 0.12, 0.02), (-0.56, -1.13, 0.02)],
    ]
    return [curve_object(f"GitRails_{index + 1}", path, bevel=0.075, material=material, parent=parent) for index, path in enumerate(paths)]


def make_node(name: str, location: tuple[float, float, float], *, material: bpy.types.Material, parent: bpy.types.Object) -> bpy.types.Object:
    bpy.ops.mesh.primitive_torus_add(major_segments=24, minor_segments=10, major_radius=0.235, minor_radius=0.075, location=location)
    node = bpy.context.object
    node.name = name
    node.data.materials.append(material)
    node.parent = parent
    node["pulseRole"] = "node"
    for polygon in node.data.polygons:
        polygon.use_smooth = True
    return node


def make_waveform(material: bpy.types.Material, parent: bpy.types.Object) -> bpy.types.Object:
    points = [
        (-2.24, 0.02, 0.12),
        (-1.78, 0.02, 0.12),
        (-1.54, 0.38, 0.12),
        (-1.28, -0.48, 0.12),
        (-0.97, 0.2, 0.12),
        (-0.67, 0.04, 0.12),
        (-0.35, 0.05, 0.12),
        (0.02, 0.05, 0.12),
        (0.28, 0.05, 0.12),
        (0.56, 0.05, 0.12),
        (0.9, 0.05, 0.12),
        (1.32, 0.05, 0.12),
        (1.76, 0.05, 0.12),
        (2.24, 0.05, 0.12),
    ]
    waveform = curve_object("Waveform", points, bevel=0.095, material=material, parent=parent)
    waveform["pulseRole"] = "waveform"
    return waveform


def look_at(obj: bpy.types.Object, target: tuple[float, float, float]) -> None:
    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def make_camera() -> bpy.types.Camera:
    camera_data = bpy.data.cameras.new("PulseCamera")
    camera = bpy.data.objects.new("PulseCamera", camera_data)
    bpy.context.collection.objects.link(camera)
    camera.location = (5.8, -8.6, 4.7)
    camera.data.lens = 58
    look_at(camera, (0.0, 0.0, 0.0))
    bpy.context.scene.camera = camera
    return camera_data


def make_light(name: str, location: tuple[float, float, float], *, energy: float, size: float, color: tuple[float, float, float]) -> None:
    light_data = bpy.data.lights.new(name, "AREA")
    light_data.energy = energy
    light_data.shape = "DISK"
    light_data.size = size
    light_data.color = color
    light = bpy.data.objects.new(name, light_data)
    bpy.context.collection.objects.link(light)
    light.location = location
    look_at(light, (0.0, 0.0, 0.0))


def configure_scene() -> None:
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE_NEXT"
    scene.render.resolution_x = 960
    scene.render.resolution_y = 960
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "WEBP"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.filepath = str(POSTER_PATH)
    scene.render.film_transparent = False
    scene.world.color = (0.008, 0.015, 0.012)
    scene.view_settings.look = "AgX - Medium High Contrast"


def export_outputs() -> None:
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))
    bpy.ops.export_scene.gltf(filepath=str(GLB_PATH), export_format="GLB", export_apply=True, export_cameras=False, export_lights=False)
    bpy.ops.render.render(write_still=True)


def build() -> None:
    clear_scene()
    ring_material = make_material("RingCeramic", (0.82, 0.87, 0.86, 1.0), metallic=0.16, roughness=0.28)
    cyan_material = make_material("PulseCyan", (0.004, 0.48, 0.56, 1.0), metallic=0.22, roughness=0.24, emission=(0.0, 0.42, 0.5, 1.0))
    orange_material = make_material("PulseOrange", (0.95, 0.24, 0.045, 1.0), metallic=0.18, roughness=0.22, emission=(0.8, 0.12, 0.015, 1.0))
    root = make_root()
    make_ring(ring_material, root)
    make_rails(cyan_material, root)
    make_node("GitNodeTop", (-0.52, 0.98, 0.09), material=cyan_material, parent=root)
    make_node("GitNodeLeft", (-1.52, 0.35, 0.09), material=cyan_material, parent=root)
    make_node("GitNodeBottom", (-0.56, -1.13, 0.09), material=cyan_material, parent=root)
    make_waveform(orange_material, root)
    make_camera()
    make_light("KeyLight", (4.0, -4.0, 6.5), energy=650.0, size=4.0, color=(0.92, 0.98, 1.0))
    make_light("CyanRim", (-4.0, 2.5, 4.0), energy=450.0, size=3.0, color=(0.1, 0.65, 0.78))
    make_light("OrangeRim", (3.0, 3.5, 1.0), energy=360.0, size=2.5, color=(1.0, 0.24, 0.05))
    configure_scene()
    export_outputs()


if __name__ == "__main__":
    build()
