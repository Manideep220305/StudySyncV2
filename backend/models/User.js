const mongoose=require('mongoose');
const bcrypt=require('bcryptjs');

const userSchema = new mongoose.Schema({
    username:{
        type: String,
        required: [true,'Please provide a username'],
        unique: true,
        trim: true,
        minlength: 3
    },
    email:{
        type: String,
        required:[true,'Please provide an email'],
        unique: true,
        lowercase: true,
        match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    password:{
        type: String,
        required: [true, 'Please provide a password'],  
        minlength: 6,
        select: false  //this hides the password from GET queries by default
//when you fetch(GET) a user profile, the hashed password isn't even sent to the backend logic unless you explicitly ask for it. This prevents accidental leaks.
    },
    avatar:{
        type: String,
        default: 'default-avatar.png' // You'll link this to Cloudinary later
    },
    totalPoints:{
        type: Number,
        default: 0,
        index: true // for fast leaderboard sorting
    },
    bio:{
        type: String,
        maxlength: 150
    }
},{timestamps: true});

//before the user is saved , hash the password
userSchema.pre('save',async function(){//'pre' means before something ,so here ,its before save function
    //only hash if password is being modified(or is new)
    if(!this.isModified('password')){
        return;
    }
    //generate salt and hash the password
    const salt= await bcrypt.genSalt(10);
    this.password=await bcrypt.hash(this.password,salt);
});

//comparing the passwords
userSchema.methods.comparePassword=async function(candidatePassword){
    return await bcrypt.compare(candidatePassword,this.password);
};

module.exports=mongoose.model('User',userSchema);

