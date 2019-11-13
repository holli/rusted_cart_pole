use piston_window::{EventLoop, PistonWindow, WindowSettings};
use plotters::prelude::*;
// use std::collections::vec_deque::VecDeque;
// use piston_window::{circle_arc, ellipse, line, rectangle, Event, Loop};

extern crate piston_window;

// use piston_window::*;


fn main() {
    let mut window: PistonWindow = WindowSettings::new("Hello Piston!", (640, 480))
        // .exit_on_esc(true)
        // .controllers(false)
        .samples(1)
        .build()
        .unwrap_or_else(|e| { panic!("Failed to build PistonWindow: {}", e) });

    // let e = window.next();
    // let e = window.next().unwrap();
    // window.draw_2d(&e, |_c, g, _y| {
    //     clear([0.5, 1.0, 0.5, 1.0], g);
    // });

    for i in 0..255 {
        println!("Sleeping like a baby {}", i);
        let tes = plotters::drawing::draw_piston_window(&mut window, |b| {
            let root = b.into_drawing_area();
            root.fill(&RGBColor(100, i, i))?;
            println!("INSIDE {}", i);
            Ok(())
        });
        println!("info: {:?}", tes);
        std::thread::sleep(std::time::Duration::from_millis(50));
    }


    // for i in 0..255 {
//         // let e = window.next().unwrap();


//         // window.draw_2d(&e, |_c, g, _y| {
//         //     clear([0.5, (i as f32)/100.0, (i as f32)/100.0, 1.0], g);
//         // });

//         // plotters::prelude::draw_piston_window(&mut window, |b| {
//         // plotters::drawing::backend_impl::piston::draw_piston_window(&mut window, |b| {
//         plotters::drawing::draw_piston_window(&mut window, |b| {
//             let root = b.into_drawing_area();
//             root.fill(&RGBColor(100, i, i))?;

// println!("Sleeping like a baby {}", i);
//             Ok(())
//         });


//         std::thread::sleep(std::time::Duration::from_millis(10));
//     }

    // std::thread::sleep(std::time::Duration::from_millis(1000));

    // let e = window.next().unwrap();
    // window.draw_2d(&e, |_c, g, _y| {
    //     clear([0.5, 1.0, 0.5, 1.0], g);
    // });

    // std::thread::sleep(std::time::Duration::from_millis(3000));

    // while let Some(e) = window.next() {
    //     window.draw_2d(&e, |_c, g, _y| {
    //         clear([0.5, 1.0, 0.5, 1.0], g);
    //     });
    // }
    // while let Some(e) = window.next() {
    //     window.draw_2d(&e, |c, g, _| {
    //         clear([0.5, 0.5, 0.5, 1.0], g);
    //         rectangle([1.0, 0.0, 0.0, 1.0], // red
    //                   [0.0, 0.0, 100.0, 100.0], // rectangle
    //                   c.transform, g);
    //     });
    // }
}

// fn main() -> Result<(), Box<dyn std::error::Error>> {
//     let root_drawing_area =
//         BitMapBackend::new("tmp/test.png", (300, 200)).into_drawing_area();
//     // And we can split the drawing area into 3x3 grid
//     let child_drawing_areas = root_drawing_area.split_evenly((3, 3));
//     // Then we fill the drawing area with different color
//     for (area, color) in child_drawing_areas.into_iter().zip(0..) {
//         area.fill(&Palette99::pick(color))?;
//     }

//     println!("YEA END OF STUFF");
//     Ok(())
// }

// const FPS: u32 = 10;
// const LENGTH: u32 = 20;
// const N_DATA_POINTS: usize = (FPS * LENGTH) as usize;
// fn main() {
//     let mut window: PistonWindow = WindowSettings::new("Real Time CPU Usage", [450, 300])
//         .samples(4)
//         .build()
//         .unwrap();
//     let sys = System::new();
//     window.set_max_fps(FPS as u64);
//     let mut load_measurement: Vec<_> = (0..FPS).map(|_| sys.cpu_load().unwrap()).collect();
//     let mut epoch = 0;
//     let mut data = vec![];
//     while let Some(_) = draw_piston_window(&mut window, |b| {
//         let cpu_loads = load_measurement[epoch % FPS as usize].done()?;

//         let root = b.into_drawing_area();
//         root.fill(&WHITE)?;

//         if data.len() < cpu_loads.len() {
//             for _ in data.len()..cpu_loads.len() {
//                 data.push(VecDeque::from(vec![0f32; N_DATA_POINTS + 1]));
//             }
//         }

//         for (core_load, target) in cpu_loads.into_iter().zip(data.iter_mut()) {
//             if target.len() == N_DATA_POINTS + 1 {
//                 target.pop_front();
//             }
//             target.push_back(1.0 - core_load.idle);
//         }

//         let mut cc = ChartBuilder::on(&root)
//             .margin(10)
//             .caption("Real Time CPU Usage", ("sans-serif", 30).into_font())
//             .x_label_area_size(40)
//             .y_label_area_size(50)
//             .build_ranged(0..N_DATA_POINTS as u32, 0f32..1f32)?;

//         cc.configure_mesh()
//             .x_label_formatter(&|x| format!("{}", -(LENGTH as f32) + (*x as f32 / FPS as f32)))
//             .y_label_formatter(&|y| format!("{}%", (*y * 100.0) as u32))
//             .x_labels(15)
//             .y_labels(5)
//             .x_desc("Seconds")
//             .y_desc("% Busy")
//             .axis_desc_style(("sans-serif", 15).into_font())
//             .draw()?;

//         for (idx, data) in (0..).zip(data.iter()) {
//             cc.draw_series(LineSeries::new(
//                 (0..).zip(data.iter()).map(|(a, b)| (a, *b)),
//                 &Palette99::pick(idx),
//             ))?
//             .label(format!("CPU {}", idx))
//             .legend(move |(x, y)| {
//                 Rectangle::new([(x - 5, y - 5), (x + 5, y + 5)], &Palette99::pick(idx))
//             });
//         }

//         cc.configure_series_labels()
//             .background_style(&WHITE.mix(0.8))
//             .border_style(&BLACK)
//             .draw()?;

//         load_measurement[epoch % FPS as usize] = sys.cpu_load()?;
//         epoch += 1;
//         Ok(())
//     }) {}
// }
