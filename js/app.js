function generateEMSO(dateOfBirth, is18Plus, isMale) {

    if (isNaN(dateOfBirth)) {
        dateOfBirth = getRandomEMSOBirthday(is18Plus)
    }

    // Extract day, month, and year from the date object
    let day = dateOfBirth.getDate();
    let month = dateOfBirth.getMonth() + 1; // Months are 0-based
    let year = dateOfBirth.getFullYear();

    // Format date part (DDMMYY)
    const formattedDate = `${String(day).padStart(2, "0")}${String(month).padStart(2, "0")}${String(year).slice(-2)}`;

    // Region code (Slovenian citizens: 50–59)
    const regionCode = 50;

    // Gender-specific sequence
    const sequenceStart = isMale ? 500 : 0; // true for male, false for female

    let sequence = Math.floor(Math.random() * 500) + sequenceStart;

    // Combine the first 12 digits
    let partialEMSO = `${formattedDate}${regionCode}${String(sequence).padStart(3, "0")}`;

    // Calculate control digit
    let controlDigit = calculateControlDigit(partialEMSO);
    while (controlDigit >= 10) {
        sequence += 1;
        partialEMSO = `${formattedDate}${regionCode}${String(sequence).padStart(3, "0")}`;
        controlDigit = calculateControlDigit(partialEMSO);
    }

    return `${partialEMSO}${controlDigit}`;
}

// Function to calculate the control digit for EMŠO
function calculateControlDigit(partialEMSO) {
    const weights = [7, 6, 5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
    const sum = partialEMSO.split("").reduce((acc, digit, index) => {
        return acc + Number(digit) * weights[index];
    }, 0);

    const remainder = sum % 11;
    return remainder === 0 ? 0 : 11 - remainder;
}

function getRandomEMSOBirthday(is18Plus = false) {
    // Define the start and end dates
    const startDate = new Date(1976, 0, 1); // January 1, 1976 (month is 0-based)
    const endDate = new Date(); // Today's date
    if (is18Plus) {
        endDate.setFullYear(endDate.getFullYear() - 18); // Adjust to 18 years ago

    }
    // Get timestamps for the start and end dates
    const startTimestamp = startDate.getTime();
    const endTimestamp = endDate.getTime();

    // Generate a random timestamp between the start and end timestamps
    const randomTimestamp = Math.floor(Math.random() * (endTimestamp - startTimestamp + 1)) + startTimestamp;

    // Convert the random timestamp back to a Date object
    return new Date(randomTimestamp);
}


function updateEmsos(numberGeneratedInput, isMaleInput, is18PlusInput, dateInput, emsoOutput) {
    let numberToGenerate = numberGeneratedInput.value;
    let isMale = isMaleInput.checked;
    let is18Plus = is18PlusInput.checked;
    let dateOfBirth = new Date(dateInput.value);

    if (isNaN(numberToGenerate) || numberToGenerate === undefined) {
        numberToGenerate = 10;
    }

    if (isNaN(isMale)) {
        isMale = false;
    }

    if (isNaN(is18Plus)) {
        is18Plus = false;
    }

    let emsos = new Array(numberToGenerate);

    for (let i = 0; i < numberToGenerate; i++) {
        emsos[i] = generateEMSO(dateOfBirth, is18Plus, isMale);
    }
    emsoOutput.innerText = emsos.join("\n");


}


window.onload = function () {


    const dateInput = window.document.getElementById("date-of-birth-input");
    const is18PlusInput = window.document.getElementById("18-plus-input");
    const isMaleInput = window.document.getElementById("gender-input");
    const numberGeneratedInput = window.document.getElementById("number-generated-input");

    const refreshBtn = window.document.getElementById("refresh-btn");

    const emsoOutput = window.document.getElementById("emso-output")

    dateInput.addEventListener("input", ev => {
        updateEmsos(numberGeneratedInput, isMaleInput, is18PlusInput, dateInput, emsoOutput);
    });
    is18PlusInput.addEventListener("input", ev => {
        if (is18PlusInput.checked) {
            dateInput.value = "";
            dateInput.disabled = true;
        } else {
            dateInput.disabled = false;
        }

        updateEmsos(numberGeneratedInput, isMaleInput, is18PlusInput, dateInput, emsoOutput);
    });
    isMaleInput.addEventListener("input", ev => {
        updateEmsos(numberGeneratedInput, isMaleInput, is18PlusInput, dateInput, emsoOutput);
    });
    numberGeneratedInput.addEventListener("input", ev => {
        if (parseInt(numberGeneratedInput.value) > 100000){
            numberGeneratedInput.value = 100000
        }
        updateEmsos(numberGeneratedInput, isMaleInput, is18PlusInput, dateInput, emsoOutput);
    });
    refreshBtn.addEventListener("click", ev => {
        updateEmsos(numberGeneratedInput, isMaleInput, is18PlusInput, dateInput, emsoOutput);
    })


    updateEmsos(numberGeneratedInput, isMaleInput, is18PlusInput, dateInput, emsoOutput);
};

















