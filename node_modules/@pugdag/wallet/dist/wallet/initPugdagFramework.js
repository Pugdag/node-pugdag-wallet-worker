"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initPugdagFramework = void 0;
const wallet_1 = require("./wallet");
const initPugdagFramework = () => __awaiter(void 0, void 0, void 0, function* () {
    // console.log("Pugdag - framework: init");
    yield wallet_1.Wallet.initRuntime();
    // console.log("Pugdag - framework: ready");
});
exports.initPugdagFramework = initPugdagFramework;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5pdEthcmxzZW5GcmFtZXdvcmsuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi93YWxsZXQvaW5pdEthcmxzZW5GcmFtZXdvcmsudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7O0FBQUEscUNBQWtDO0FBRTNCLE1BQU0sb0JBQW9CLEdBQUcsR0FBUyxFQUFFO0lBQzdDLDRDQUE0QztJQUM1QyxNQUFNLGVBQU0sQ0FBQyxXQUFXLEVBQUUsQ0FBQztJQUMzQiw2Q0FBNkM7QUFDL0MsQ0FBQyxDQUFBLENBQUM7QUFKVyxRQUFBLG9CQUFvQix3QkFJL0IiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBXYWxsZXQgfSBmcm9tICcuL3dhbGxldCc7XG5cbmV4cG9ydCBjb25zdCBpbml0S2FybHNlbkZyYW1ld29yayA9IGFzeW5jICgpID0+IHtcbiAgLy8gY29uc29sZS5sb2coXCJLYXJsc2VuIC0gZnJhbWV3b3JrOiBpbml0XCIpO1xuICBhd2FpdCBXYWxsZXQuaW5pdFJ1bnRpbWUoKTtcbiAgLy8gY29uc29sZS5sb2coXCJLYXJsc2VuIC0gZnJhbWV3b3JrOiByZWFkeVwiKTtcbn07XG5cbiJdfQ==