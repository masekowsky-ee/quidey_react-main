const aPlusB = require('../components/testFunction');
describe("aPlusB Function", () => {
    test("it should add and return 2 parameters", () => {
        const inputA = 12;
        const inputB = 13;

        const output = 25;

        expect(aPlusB(inputA, inputB)).toEqual(output);
    });
});

//run "npm test -- --coverage" to see uncovered code