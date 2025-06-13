import {Inter} from "next/font/google";
import {Montserrat} from "next/font/google";
import {Lusitana} from "next/font/google";
import localFont from "next/font/local";

export const inter = Inter({subsets: ["latin"]});
export const montserrat = Montserrat({weight: ["400", "700"], subsets: ["cyrillic", "latin"]});
export const lusitana = Lusitana({weight: ["400", "700"], subsets: ["latin"]});
export const highliner = localFont({
    src: [{
        path: "./localfonts/highliner/Highliner_regular.otf",
        weight: "400",
        style: "normal",
    }, {
        path: "./localfonts/highliner/Highliner_bold.otf",
        weight: "700",
        style: "normal",
    }, {
        path: "./localfonts/highliner/Highliner_light.otf",
        weight: "200",
        style: "normal",
    }
    ]
});
